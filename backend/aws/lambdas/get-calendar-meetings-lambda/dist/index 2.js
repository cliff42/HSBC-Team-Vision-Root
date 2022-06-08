"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("./constants");
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
};
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);
const convertTimeZone = (originalTime, timezone) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
};
const getScheduledZoomMeetings = async (userId, seeFullDetails) => {
    let meetings = [];
    let pastMeetings = [];
    const params = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
                TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
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
            }
            else {
                meetings.push(results.Item);
            }
        }
    }
    return meetings;
};
const getRecordings = async (meeting) => {
    const config = { headers: { 'Authorization': `Bearer ${zoomToken}` } };
    const path = "https://api.zoom.us/v2/meetings/" + meeting.MeetingID + "/recordings";
    try {
        const res = await axios_1.default.get(path, config);
        if (res) {
            let recordingFiles = res.data.recording_files;
            let recordings = recordingFiles.filter(x => x.file_type === "MP4").map(({ deleted_time, download_url, file_path, file_size, file_type, id, meeting_id, play_url, recording_end, recording_start, recording_type, status }) => ({
                link: play_url,
                startTime: recording_start,
                endTime: recording_end
            }));
            meeting.recordings = recordings;
            meeting.recordingsPassword = res.data.password;
        }
    }
    catch (e) {
        console.log("No recording found, continuing");
    }
    return meeting;
};
const getZoomID = async (userId) => {
    const params = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
    }
    else {
        throw "Error: Invalid UserID";
    }
};
const sendUserMessage = async (id, body) => {
    try {
        await gateway.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    }
    catch (err) {
        console.log(err);
    }
};
const generateError = async (connectionID, errmsg) => {
    await sendUserMessage(connectionID, { Error: errmsg });
    return {
        statusCode: 500,
        body: JSON.stringify({
            message: errmsg,
        }),
    };
};
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    let response;
    let reqbody;
    if (event.body) {
        reqbody = JSON.parse(event.body);
    }
    const action = reqbody.action;
    let id;
    if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
        id = event.requestContext.authorizer.principalId;
    }
    let returnbody = { data: "nothing to return" };
    if (id == null) {
        return await generateError(connectionId, "Id not set");
    }
    try {
        switch (action) {
            case 'getOwnCalendarMeetings':
                returnbody = { calendarMeetings: await getScheduledZoomMeetings(id, true) };
                break;
            case 'getUserCalendarMeetings':
                let userId;
                if (reqbody.UserID) {
                    userId = reqbody.UserID;
                }
                else {
                    return await generateError(connectionId, "UserID not given");
                }
                returnbody = { userCalendarMeetings: await getScheduledZoomMeetings(userId, false) };
                break;
            default:
        }
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    }
    catch (err) {
        console.log(err);
        return await generateError(connectionId, "Error in scheduled meetings lambda: " + err);
    }
    return response;
};
exports.handler = handler;
const DEPRACATEDgetScheduledZoomMeetings = async (zoomId, options) => {
    const path = 'https://api.zoom.us/v2/users/' + zoomId + '/meetings';
    let meetings = [];
    let results = {};
    do {
        let config = {
            headers: { 'Authorization': `Bearer ${zoomToken}` },
            params: {
                type: "upcoming_meetings",
                page_size: 100
            }
        };
        if (options.getPreviousMeetings) {
            config.params.type = "previous_meetings";
        }
        if ('next_page_token' in results) {
            config.next_page_token = results.next_page_token;
            config.page_number = results.page_number;
        }
        console.log(config);
        const res = await axios_1.default.get(path, config);
        if (res) {
            results = res.data;
            meetings = meetings.concat(results.meetings);
        }
        else {
            throw "error in getScheduledZoomMeetings, zoom api request failed";
        }
    } while ('next_page_token' in results && results.next_page_token !== '');
    console.log(meetings);
    let reformattedMeetings;
    if (options.seeAvailabilitiesOnly) {
        reformattedMeetings = meetings.filter(x => x.duration > 0).map(({ agenda, created_at, duration, host_id, id, join_url, pmi, start_time, timezone, topic, type, uuid }) => ({
            startDate: convertTimeZone(start_time, timezone).toUtcString().substring(0, 19) + 'Z',
            endDate: convertTimeZone(start_time, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z',
        }));
    }
    else {
        reformattedMeetings = meetings.filter(x => x.duration > 0).map(({ agenda, created_at, duration, host_id, id, join_url, pmi, start_time, timezone, topic, type, uuid }) => ({
            title: topic,
            startDate: convertTimeZone(start_time, timezone).toUtcString().substring(0, 19) + 'Z',
            endDate: convertTimeZone(start_time, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z',
            link: join_url,
            meetingId: id
        }));
    }
    console.log(reformattedMeetings);
    return reformattedMeetings;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBMEI7QUFDMUIsMkNBQW9DO0FBT3BDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3ZDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUVwQyxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFL0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBRWpELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLHVCQUF1QixDQUFDLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBRzlGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQzlDLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDO0FBRXBELE1BQU0sV0FBVyxHQUFHO0lBQ2hCLEdBQUcsRUFBRSxZQUFZO0lBQ2pCLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQztDQUN2QyxDQUFBO0FBQ0QsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFFekQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxZQUFpQixFQUFFLFFBQWdCLEVBQUUsRUFBRTtJQUM1RCxNQUFNLHNCQUFzQixHQUFHLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ2hGLE9BQU8sc0JBQXNCLENB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