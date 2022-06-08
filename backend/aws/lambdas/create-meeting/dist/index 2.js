"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("./constants");
const timezonecomplete_1 = require("timezonecomplete");
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
};
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);
const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const NOTIFICATION_THRESHOLD = 1; // in minutes
const scheduleMeetingNotifications = async (meetingInfo) => {
    const startDate = new timezonecomplete_1.DateTime(meetingInfo.start_time);
    const time15MinBefore = startDate.sub(15, timezonecomplete_1.TimeUnit.Minute);
    const time30MinBefore = startDate.sub(30, timezonecomplete_1.TimeUnit.Minute);
    if (startDate.diff(timezonecomplete_1.DateTime.nowUtc()).minutes() > 30 + NOTIFICATION_THRESHOLD) {
        const name = "30MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, time30MinBefore, { ruleName: name, data: meetingInfo, notificationType: "30Minute" });
    }
    else if (startDate.diff(timezonecomplete_1.DateTime.nowUtc()).minutes() > 15 + NOTIFICATION_THRESHOLD) {
        const name = "15MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, time15MinBefore, { ruleName: name, data: meetingInfo, notificationType: "15Minute" });
    }
    else {
        const name = "MeetingNotification" + meetingInfo.id;
        await createEventBridgeRule(name, startDate, { ruleName: name, data: meetingInfo, notificationType: "Now" });
    }
};
const createEventBridgeRule = async (name, time, data) => {
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
};
const createZoomMeeting = async (userId, zoomId, body, scheduled) => {
    let path = 'https://api.zoom.us/v2/users/' + zoomId + '/meetings';
    let meetingTopic = "New Zoom Meeting";
    if (body.topic != null) {
        meetingTopic = body.topic;
    }
    let meeting = {
        topic: meetingTopic
    };
    let meetingSettings = {};
    if (scheduled) {
        meeting.type = 2;
        if (!(body.startTime && body.members && body.endTime)) {
            throw "createScheduledMeeting missing one of required params: startTime, endTime, members";
        }
        meeting.start_time = body.startTime;
        const startTime = new tc.DateTime(body.startTime);
        const endTime = new tc.DateTime(body.endTime);
        const timeDifference = endTime.diff(startTime);
        if (timeDifference.minutes() < 0) {
            throw "endTime must come after startTime and must be at least a minute long";
        }
        if (startTime.diff(timezonecomplete_1.DateTime.nowUtc()).minutes() < NOTIFICATION_THRESHOLD) {
            throw "Meeting must begin at least " + NOTIFICATION_THRESHOLD + " minutes in the future";
        }
        console.log(timeDifference.minutes());
        meeting.duration = timeDifference.minutes();
        meeting.timezone = 'UTC';
    }
    else {
        meeting.type = 1;
    }
    if (body.waitingRoom) {
        meetingSettings.waiting_room = true;
    }
    else {
        meetingSettings.join_before_host = true;
    }
    meeting.settings = meetingSettings;
    let res = await axios_1.default.post(path, meeting, { headers: { 'Authorization': `Bearer ${zoomToken}` } });
    if (res) {
        if (scheduled) {
            // await registerUsers(res.data.id, body.members);
            await addMeetingToDb(userId, res.data, body.members);
            await scheduleMeetingNotifications(res.data);
            // return {link: res.data.join_url, id: res.data.id};
            return { "Confirmation": "Successfully created a scheduled meeting" };
        }
        return res.data;
    }
    else {
        throw "Error with axios request to zoom";
    }
};
const convertTimeZone = (originalTime, timezone) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
};
const registerUsers = async (meetingId, invitees) => {
    const path = 'https://api.zoom.us/v2/meetings/' + meetingId + '/batch_registrants';
    let registrants = [];
    for (let member of invitees) {
        const params = {
            TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
        let res = await axios_1.default.post(path, { auto_approve: 1, registrants: atmost30 }, { headers: { 'Authorization': `Bearer ${zoomToken}` } });
        if (res) {
            counter = counter + 30;
        }
        else {
            throw "Error with axios request to zoom in user Registration";
        }
    }
};
const addMeetingToDb = async (userId, meeting, members) => {
    meeting.id = meeting.id.toString();
    members.push(userId);
    let invitees = [];
    for (let member of members) {
        const params = {
            TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
            invitees.push({ UserID: results.Item.UserID, name: results.Item.name });
        }
        else {
            throw "One or more meeting members are invalid";
        }
        const addToUserScheduledMeetingsParams = {
            TableName: constants_1.dbInfo.USER_TABLE_NAME,
            Key: { UserID: member },
            UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
            ExpressionAttributeNames: { '#a': 'scheduledMeetings' },
            ExpressionAttributeValues: {
                ':x': [meeting.id],
                ':empty_list': []
            },
            ReturnValues: "UPDATED_NEW"
        };
        await dynamo.update(addToUserScheduledMeetingsParams).promise();
    }
    const createScheduledMeetingParams = {
        TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
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
};
const sendLinksToInvitedUsers = async (currentId, members, meetingResponse) => {
    try {
        // make sure the host also gets the link
        await sendUserMessage(currentId, { incomingCall: { topic: meetingResponse.topic, url: meetingResponse.join_url, host: true, scheduled: false } });
        // get the connection ids for each user in memebrs
        await Promise.all(members.map(async (member) => {
            let userQuery = {
                TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
    }
    catch (err) {
        console.log(err);
    }
};
const sendUserMessage = async (id, body) => {
    try {
        await client.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    }
    catch (err) {
        console.log(err);
    }
};
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    try {
        console.log(event);
        // only perform actions if received a websocket event
        if (event.requestContext) {
            // get websocket connection information
            const routeKey = event.requestContext.routeKey;
            const body = JSON.parse(event.body || "{}");
            let userId = "";
            if (event.requestContext.authorizer) {
                userId = event.requestContext.authorizer.principalId;
            }
            let userQuery = {
                TableName: constants_1.dbInfo.USER_TABLE_NAME,
                KeyConditionExpression: "UserID = :userid",
                ExpressionAttributeValues: {
                    ":userid": userId
                }
            };
            let dbResult = await dynamo.query(userQuery).promise();
            let zoomId = "me";
            if (dbResult.Items.length > 0) {
                zoomId = dbResult.Items[0].zoomId;
            }
            switch (body.action) {
                case 'createMeeting':
                    const createMeetingResponse = await createZoomMeeting(userId, zoomId, body.body, false);
                    // send the meeting link to all of the invited users
                    await sendLinksToInvitedUsers(connectionId, body.body.members, createMeetingResponse);
                    // send response through websocket connection
                    await sendUserMessage(connectionId, createMeetingResponse);
                    break;
                case 'createScheduledMeeting':
                    const createScheduledMeetingResponse = await createZoomMeeting(userId, zoomId, body.body, true);
                    // send response through websocket connection
                    await sendUserMessage(connectionId, createScheduledMeetingResponse);
                    break;
                default:
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ data: 'hello from createMeeting' }),
        };
    }
    catch (error) {
        sendUserMessage(connectionId, { Error: error });
        console.error(error);
        return {
            statusCode: 500,
            body: "CREATE MEETING ERROR",
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBMEI7QUFDMUIsMkNBQW9DO0FBTXBDLHVEQUFzRDtBQUV0RCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDL0IsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRXZDLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQzFDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ2hDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxrREFBa0Q7QUFDbEQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7QUFDOUMsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUM7QUFFcEQsTUFBTSxXQUFXLEdBQUc7SUFDaEIsR0FBRyxFQUFFLFlBQVk7SUFDakIsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO0NBQ3ZDLENBQUE7QUFDRCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQztBQUV6RCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUM3RixNQUFNLHNCQUFzQixHQUFHLENBQUMsQ0FBQyxDQUFDLGFBQWE7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