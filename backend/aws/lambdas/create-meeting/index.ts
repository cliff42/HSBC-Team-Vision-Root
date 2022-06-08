import axios from "axios";
import { dbInfo} from "./constants";
import type {
    APIGatewayProxyResult,
    APIGatewayProxyHandler,
    APIGatewayProxyEvent,
} from "aws-lambda";
import { DateTime, TimeUnit } from "timezonecomplete";

const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const tc = require("timezonecomplete");

const eventBridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();
const dynamo = new AWS.DynamoDB.DocumentClient();

// get key and secret from lambda environment vars
const ZOOM_API_KEY = process.env.ZOOM_API_KEY;
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET;

const zoomPayload = {
    iss: ZOOM_API_KEY,
    exp: ((new Date()).getTime() + 5000)
}
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);

const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const NOTIFICATION_THRESHOLD = 1; // in minutes

const scheduleMeetingNotifications =  async (meetingInfo: any) => {
    const startDate = new DateTime(meetingInfo.start_time);
    const time15MinBefore = startDate.sub(15, TimeUnit.Minute);
    const time30MinBefore = startDate.sub(30, TimeUnit.Minute);

    if(startDate.diff(DateTime.nowUtc()).minutes() > 30 + NOTIFICATION_THRESHOLD) {
        const name = "30MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, time30MinBefore, { ruleName: name, data: meetingInfo, notificationType: "30Minute"  });
    } else if(startDate.diff(DateTime.nowUtc()).minutes() > 15 + NOTIFICATION_THRESHOLD) {
        const name = "15MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, time15MinBefore, { ruleName: name, data: meetingInfo, notificationType: "15Minute" });
    } else {
        const name = "MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, startDate, { ruleName: name, data: meetingInfo, notificationType: "Now" });
    } 
}

const createEventBridgeRule = async (name: string, time: DateTime, data: object) => {
    const rule = await eventBridge.putRule({
        Name: name,
        ScheduleExpression: 'cron(' + time.utcMinute() + ' ' + time.utcHour() + ' ' + time.utcDay() + ' ' + 
        time.utcMonth() + ' ' + '?' + ' ' + time.utcYear() + ')'
    }).promise();

    await lambda.addPermission({
        Action: 'lambda:InvokeFunction',
        FunctionName: 'NotificationLambdaFunction',
        Principal: 'events.amazonaws.com',
        StatementId: name,
        SourceArn: rule.RuleArn,
    }).promise();

    return await eventBridge.putTargets({
        Rule: name,
        Targets: [
            {
                Id: `${name}-target`,
                Arn: process.env.NOTIFICATION_FUNCTION_ARN,
                Input: JSON.stringify(data),
            },
        ],
    }).promise();
}


const createZoomMeeting = async (userId: string, zoomId: string, body: any, scheduled: boolean) => {
    let path: string = 'https://api.zoom.us/v2/users/' + zoomId + '/meetings';

    let meetingTopic: string = "New Zoom Meeting";
    if (body.topic != null) {
        meetingTopic = body.topic;
    }

    let meeting: Record<string, any> = {
        topic: meetingTopic
    };
    let meetingSettings: Record<string, any> = {};

    if (scheduled) {
        meeting.type = 2;
        if (!(body.startTime && body.members && body.endTime)) {
            throw "createScheduledMeeting missing one of required params: startTime, endTime, members"
        }
        meeting.start_time = body.startTime;
        const startTime = new tc.DateTime(body.startTime);
        const endTime = new tc.DateTime(body.endTime);
        const timeDifference = endTime.diff(startTime);
        if (timeDifference.minutes() < 0) {
            throw "endTime must come after startTime and must be at least a minute long";
        }

        if(startTime.diff(DateTime.nowUtc()).minutes() < NOTIFICATION_THRESHOLD) {
            throw "Meeting must begin at least " + NOTIFICATION_THRESHOLD + " minutes in the future";
        }

        console.log(timeDifference.minutes());
        meeting.duration = timeDifference.minutes();
        meeting.timezone = 'UTC';
    } else {
        meeting.type = 1;
    }
    if (body.waitingRoom) {
        meetingSettings.waiting_room = true;
    } else {
        meetingSettings.join_before_host = true;
    }
    meeting.settings = meetingSettings;

    let res = await axios.post(path, meeting, {headers: {'Authorization': `Bearer ${zoomToken}`}})
    if (res) {
        if (scheduled) {
            // await registerUsers(res.data.id, body.members);
            await addMeetingToDb(userId, res.data, body.members);
            await scheduleMeetingNotifications(res.data);
            // return {link: res.data.join_url, id: res.data.id};
            return {"Confirmation":"Successfully created a scheduled meeting"};
        }
        return res.data;
    } else {
        throw "Error with axios request to zoom";
    }
}

const convertTimeZone = (originalTime: any, timezone: string) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
}

const registerUsers = async (meetingId: string, invitees: Array<any>) => {
    const path = 'https://api.zoom.us/v2/meetings/' + meetingId + '/batch_registrants';
    let registrants = [];
    for (let member of invitees) {
        const params = {
            TableName: dbInfo.USER_TABLE_NAME,
            Key: {
                UserID: member
            },
            AttributesToGet: [
                'name',
                'zoomId'
            ]
        };
        const results = await dynamo.get(params).promise();
        if (results.Item.zoomId) {
            registrants.push({ email: results.Item.zoomId, first_name: results.Item.name });
        }
        else {
            throw "One or more meeting members are invalid";
        }
    }
    let counter = 0;
    while (counter < registrants.length) {
        let atmost30 = registrants.slice(counter, counter + 30);
        let res = await axios.post(path, { auto_approve: 1, registrants: atmost30 }, { headers: { 'Authorization': `Bearer ${zoomToken}` } });
        if (res) {
            counter = counter + 30;
        }
        else {
            throw "Error with axios request to zoom in user Registration";
        }
    }
};

const addMeetingToDb = async (userId: string, meeting: any, members: Array<string>) => {
    meeting.id = meeting.id.toString();
    members.push(userId);
    let invitees = [];
    for (let member of members) {
        const params = {
            TableName: dbInfo.USER_TABLE_NAME,
            Key: {
                UserID: member
            },
            AttributesToGet: [
                'UserID',
                'name',
            ]
        };
        const results = await dynamo.get(params).promise();
        if (results.Item.UserID) {
            invitees.push({UserID: results.Item.UserID, name: results.Item.name});
        } else {
            throw "One or more meeting members are invalid";
        }
        const addToUserScheduledMeetingsParams = {
            TableName: dbInfo.USER_TABLE_NAME,
            Key: {UserID: member},
            UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
            ExpressionAttributeNames: {'#a': 'scheduledMeetings'},
            ExpressionAttributeValues: {
                ':x': [meeting.id],
                ':empty_list' : []
            },
            ReturnValues: "UPDATED_NEW"
        };
        await dynamo.update(addToUserScheduledMeetingsParams).promise();
    }

    const createScheduledMeetingParams = {
        TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
        Item: {
            MeetingID: meeting.id,
            link: meeting.join_url,
            title: meeting.topic,
            startDate: convertTimeZone(meeting.start_time, meeting.timezone).toUtcString().substring(0, 19) + 'Z',
            endDate: convertTimeZone(meeting.start_time, meeting.timezone).add(meeting.duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z',
            participants: invitees,
            participantsJoined: []
        }
    };
    await dynamo.put(createScheduledMeetingParams).promise();
}

const sendLinksToInvitedUsers = async(currentId: any, members: any, meetingResponse: any) => {
  try {
    // make sure the host also gets the link
    await sendUserMessage(currentId, { incomingCall: { topic: meetingResponse.topic, url: meetingResponse.join_url, host: true, scheduled: false } });

    // get the connection ids for each user in memebrs
    await Promise.all(members.map(async (member: any) => {
      let userQuery = {
        TableName: dbInfo.USER_TABLE_NAME,
        KeyConditionExpression: "UserID = :userid",
        ExpressionAttributeValues: {
            ":userid": member
        }
      };
      const dbResult = await dynamo.query(userQuery).promise();
      if (dbResult.Items[0].connectionId) {
        await sendUserMessage(dbResult.Items[0].connectionId, { incomingCall: { topic: meetingResponse.topic, url: meetingResponse.join_url, host: false, scheduled: false } });
      }
    }));
  } catch (err) {
    console.log(err);
  }
}

const sendUserMessage = async (id: any, body: any) => {
    try {
        await client.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    } catch (err) {
        console.log(err);
    }
}

export const handler: APIGatewayProxyHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId;
    try {
        console.log(event);

        // only perform actions if received a websocket event
        if (event.requestContext) {
            // get websocket connection information
            const routeKey = event.requestContext.routeKey;
            const body = JSON.parse(event.body || "{}");
            let userId: string = "";

            if (event.requestContext.authorizer) {
                userId = event.requestContext.authorizer.principalId;
            }

            let userQuery = {
                TableName: dbInfo.USER_TABLE_NAME,
                KeyConditionExpression: "UserID = :userid",
                ExpressionAttributeValues: {
                    ":userid": userId
                }
            }

            let dbResult = await dynamo.query(userQuery).promise();

            let zoomId: string = "me";
            if (dbResult.Items.length > 0) {
                zoomId = dbResult.Items[0].zoomId;
            }
            switch (body.action) {
                case 'createMeeting':
                    const createMeetingResponse: any = await createZoomMeeting(userId, zoomId, body.body, false);
                    // send the meeting link to all of the invited users
                    await sendLinksToInvitedUsers(connectionId, body.body.members, createMeetingResponse)
                    // send response through websocket connection
                    await sendUserMessage(connectionId, createMeetingResponse);
                    break;
                case 'createScheduledMeeting':
                    const createScheduledMeetingResponse: any = await createZoomMeeting(userId, zoomId, body.body, true);
                    // send response through websocket connection
                    await sendUserMessage(connectionId, createScheduledMeetingResponse);
                    break;
                default:
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({data: 'hello from createMeeting'}),
        };
    } catch (error) {
        sendUserMessage(connectionId, {Error: error})
        console.error(error);
        return {
            statusCode: 500,
            body: "CREATE MEETING ERROR",
        };
    }
};
