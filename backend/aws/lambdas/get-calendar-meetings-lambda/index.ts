import axios from "axios";
import { dbInfo} from "./constants";
import type {
    APIGatewayProxyResult,
    APIGatewayProxyHandler,
    APIGatewayProxyEvent,
} from "aws-lambda";

const tc = require("timezonecomplete");
const jwt = require("jsonwebtoken");

const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

const gateway = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });


const ZOOM_API_KEY = process.env.ZOOM_API_KEY;
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET;

const zoomPayload = {
    iss: ZOOM_API_KEY,
    exp: ((new Date()).getTime() + 5000)
}
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);

const convertTimeZone = (originalTime: any, timezone: string) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
}

const getScheduledZoomMeetings = async (userId: string, seeFullDetails: boolean): Promise<any[]> => {
    let meetings = [];
    let pastMeetings = [];
    const params = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {
            UserID: userId
        },
        AttributesToGet: [
            'scheduledMeetings'
        ]
    };
    const meetingIds = await dynamo.get(params).promise();
    if (meetingIds.Item.scheduledMeetings) {
        for (let meeting of meetingIds.Item.scheduledMeetings) {
            const params = {
                TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
                Key: {
                    MeetingID: meeting
                },
                AttributesToGet: [
                    'startDate',
                    'endDate'
                ]
            };
            if (seeFullDetails) {
                params.AttributesToGet.push('title', 'link', 'participants', 'MeetingID');
            }
            const results = await dynamo.get(params).promise();
            if (seeFullDetails && results.Item && results.Item.endDate && new Date(results.Item.endDate) < new Date()) {
                meetings.push(await getRecordings(results.Item));
            } else {
                meetings.push(results.Item);
            }
        }
    }
    return meetings;
}
const getRecordings = async (meeting: any) => {
    const config = {headers: {'Authorization': `Bearer ${zoomToken}`}};
    const path = "https://api.zoom.us/v2/meetings/" + meeting.MeetingID + "/recordings";
        try {
            const res = await axios.get(path, config)
            if (res) {
                let recordingFiles: Array<any> = res.data.recording_files;
                let recordings = recordingFiles.filter(x => x.file_type === "MP4").map(({
                                                         deleted_time,
                                                         download_url,
                                                         file_path,
                                                         file_size,
                                                         file_type,
                                                         id,
                                                         meeting_id,
                                                         play_url,
                                                         recording_end,
                                                         recording_start,
                                                         recording_type,
                                                         status
                                                     }) => ({
                    link: play_url,
                    startTime: recording_start,
                    endTime: recording_end
                }));
                meeting.recordings = recordings;
                meeting.recordingsPassword = res.data.password;
            }
        } catch (e) {
            console.log("No recording found, continuing");
        }
    return meeting;
}

const getZoomID = async (userId: string) => {
    const params = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {
            UserID: userId
        },
        AttributesToGet: [
            'zoomId'
        ]
    };
    const results = await dynamo.get(params).promise();
    if (results.Item.zoomId) {
        return results.Item.zoomId;
    } else {
        throw "Error: Invalid UserID";
    }
}

const sendUserMessage = async (id: any, body: any) => {
    try {
        await gateway.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    } catch (err) {
        console.log(err);
    }
}


const generateError = async (connectionID: any, errmsg: string): Promise<APIGatewayProxyResult> => {
    await sendUserMessage(connectionID, {Error: errmsg});
    return {
        statusCode: 500,
        body: JSON.stringify({
            message: errmsg,
        }),
    };
}

export const handler: APIGatewayProxyHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId;
    let response: APIGatewayProxyResult;
    let reqbody;
    if (event.body) {
        reqbody = JSON.parse(event.body);
    }
    const action = reqbody.action;
    let id;
    if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
        id = event.requestContext.authorizer.principalId;
    }
    let returnbody: any = {data: "nothing to return"};
    if (id == null) {
        return await generateError(connectionId, "Id not set");
    }
    try {
        switch (action) {
            case 'getOwnCalendarMeetings':
                returnbody = {calendarMeetings: await getScheduledZoomMeetings(id, true)};
                break;
            case 'getUserCalendarMeetings':
                let userId;
                if (reqbody.UserID) {
                    userId = reqbody.UserID;
                } else {
                    return await generateError(connectionId, "UserID not given");
                }
                returnbody = {userCalendarMeetings:  await getScheduledZoomMeetings(userId, false)};
                break;
            default:
        }
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    } catch (err) {
        console.log(err);
        return await generateError(connectionId, "Error in scheduled meetings lambda: " + err);
    }

    return response;
};

const DEPRACATEDgetScheduledZoomMeetings = async (zoomId: string, options: any): Promise<any[]> => {
    const path = 'https://api.zoom.us/v2/users/' + zoomId + '/meetings';
    let meetings: Array<any> = [];
    let results: Record<string, any> = {};
    do {
        let config: Record<string, any> = {
            headers: {'Authorization': `Bearer ${zoomToken}`},
            params: {
                type: "upcoming_meetings",
                page_size: 100
            }
        }
        if (options.getPreviousMeetings) {
            config.params.type = "previous_meetings";
        }
        if ('next_page_token' in results) {
            config.next_page_token = results.next_page_token;
            config.page_number = results.page_number;
        }
        console.log(config);
        const res = await axios.get(path, config);
        if (res) {
            results = res.data;
            meetings = meetings.concat(results.meetings);
        } else {
            throw "error in getScheduledZoomMeetings, zoom api request failed";
        }
    } while ('next_page_token' in results && results.next_page_token !== '')

    console.log(meetings);
    let reformattedMeetings;
    if (options.seeAvailabilitiesOnly) {
        reformattedMeetings = meetings.filter(x => x.duration > 0).map(({
                                                                            agenda,
                                                                            created_at,
                                                                            duration,
                                                                            host_id,
                                                                            id,
                                                                            join_url,
                                                                            pmi,
                                                                            start_time,
                                                                            timezone,
                                                                            topic,
                                                                            type,
                                                                            uuid
                                                                        }) => ({
            startDate: convertTimeZone(start_time, timezone).toUtcString().substring(0, 19) + 'Z',
            endDate: convertTimeZone(start_time, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z',
        }));
    } else {
        reformattedMeetings = meetings.filter(x => x.duration > 0).map(({
                                                                            agenda,
                                                                            created_at,
                                                                            duration,
                                                                            host_id,
                                                                            id,
                                                                            join_url,
                                                                            pmi,
                                                                            start_time,
                                                                            timezone,
                                                                            topic,
                                                                            type,
                                                                            uuid
                                                                        }) => ({
            title: topic,
            startDate: convertTimeZone(start_time, timezone).toUtcString().substring(0, 19) + 'Z',
            endDate: convertTimeZone(start_time, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z',
            link: join_url,
            meetingId: id
        }));
    }
    console.log(reformattedMeetings);
    return reformattedMeetings;
}