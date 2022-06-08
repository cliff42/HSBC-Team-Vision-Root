"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("./constants");
var MeetingType;
(function (MeetingType) {
    MeetingType[MeetingType["Prescheduled"] = 0] = "Prescheduled";
    MeetingType[MeetingType["Instant"] = 1] = "Instant";
    MeetingType[MeetingType["Scheduled"] = 2] = "Scheduled";
    MeetingType[MeetingType["Recurring"] = 3] = "Recurring";
    MeetingType[MeetingType["Personal"] = 4] = "Personal";
    MeetingType[MeetingType["PAC"] = 5] = "PAC";
    MeetingType[MeetingType["RecurringFixed"] = 6] = "RecurringFixed";
})(MeetingType || (MeetingType = {}));
var Notification;
(function (Notification) {
    Notification["MeetingStarting"] = "MeetingStarting";
    Notification["MeetingIn15"] = "MeetingIn15";
    Notification["MeetingIn30"] = "MeetingIn30";
})(Notification || (Notification = {}));
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const tc = require("timezonecomplete");
const dynamo = new AWS.DynamoDB.DocumentClient();
const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const sleep = require('util').promisify(setTimeout);
const ZOOM_API_KEY = process.env.ZOOM_API_KEY;
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET;
const zoomPayload = {
    iss: ZOOM_API_KEY,
    exp: ((new Date()).getTime() + 5000)
};
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);
const sendZoomAPICall = (URL, queryParameters) => {
    return new Promise((resolve, reject) => {
        const path = 'https://api.zoom.us/v2/' + URL;
        axios_1.default.post(path, queryParameters, { headers: { 'Authorization': `Bearer ${zoomToken}` } })
            .then(function (res) {
            resolve(res.data);
        })
            .catch(function (err) {
            console.log(err);
            reject(err);
        });
    });
};
const getZoomMeetingData = (meetingId) => {
    return new Promise((resolve, reject) => {
        dynamo.query({
            TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
            KeyConditionExpression: "MeetingID = :id",
            ExpressionAttributeValues: {
                ":id": meetingId
            }
        }, function (error, data) {
            var _a;
            if (!error) {
                (_a = data.Items) === null || _a === void 0 ? void 0 : _a.forEach(function (item) {
                    if (item.MeetingID == meetingId) {
                        // return the meeting
                        resolve(item);
                    }
                });
            }
            reject("No meeting found with MeetingId: " + meetingId);
        });
    });
};
const getMeetingDetailsFromZoom = (meetingId) => {
    return new Promise(async (resolve, reject) => {
        let path = 'https://api.zoom.us/v2/meetings/' + meetingId;
        let res = await axios_1.default.get(path, { headers: { 'Authorization': `Bearer ${zoomToken}` } });
        if (res) {
            resolve(res.data);
        }
        else {
            reject("Error getting meeting details from zoom");
        }
    });
};
const getUserDetailsFromZoom = (userId) => {
    return new Promise(async (resolve, reject) => {
        let path = 'https://api.zoom.us/v2/users/' + userId;
        let res = await axios_1.default.get(path, { headers: { 'Authorization': `Bearer ${zoomToken}` } });
        if (res) {
            resolve(res.data);
        }
        else {
            reject("Error getting user details from zoom");
        }
    });
};
const convertTimeZone = (originalTime, timezone) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
};
const isMeetingInDatabse = (meetingId) => {
    return new Promise(async (resolve, reject) => {
        let joinedMeetingQuery = {
            TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
            KeyConditionExpression: "MeetingID = :meetingid",
            ExpressionAttributeValues: {
                ":meetingid": String(meetingId)
            }
        };
        const dbResult = await dynamo.query(joinedMeetingQuery).promise();
        if (!dbResult.Items) {
            reject("error reaching DB");
        }
        // true if query yeilds more than 0 results
        if (dbResult.Items.length > 0) {
            resolve(true);
        }
        else {
            resolve(false);
        }
    });
};
const getUser = (userId) => {
    return new Promise((resolve, reject) => {
        dynamo.query({
            TableName: 'UserData',
            KeyConditionExpression: "UserID = :id",
            ExpressionAttributeValues: {
                ":id": userId
            }
        }, function (error, data) {
            var _a;
            if (!error) {
                (_a = data.Items) === null || _a === void 0 ? void 0 : _a.forEach(function (item) {
                    if (item.UserID == userId) {
                        // return the user
                        resolve(item);
                    }
                });
            }
            reject("No user found with UserId: " + userId);
        });
    });
};
const getUserRankFromId = (userId) => {
    return new Promise(async (resolve, reject) => {
        let userQuery = {
            TableName: constants_1.dbInfo.USER_TABLE_NAME,
            KeyConditionExpression: "UserID = :userid",
            ExpressionAttributeValues: {
                ":userid": userId
            }
        };
        let dbResult = await dynamo.query(userQuery).promise();
        if (dbResult.Items[0]) {
            // get rank from userId
            resolve(Number(dbResult.Items[0].rank));
        }
        else {
            reject("error getting rank for userId");
        }
    });
};
const sendAllUsersMessage = async (users, body) => {
    const all = users.map((user) => sendUserMessage(user.connectionId, body));
    return Promise.all(all);
};
// cached list of connected users
let connected_users = new Array();
const sendAllConnectedUsersMessage = async (ids, body) => {
    const all = ids.map(id => sendUserMessage(id, body));
    return Promise.all(all);
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
// sends updated list of active meetings to all connected users
const sendUpdatedActiveMeetings = async () => {
    // need to send correct meetings for each user
    // get all connectionIds from userDb
    let dbResult = await dynamo.scan({ TableName: constants_1.dbInfo.USER_TABLE_NAME }).promise();
    const users = dbResult.Items;
    // send updated list of meetings to all users
    dbResult = await dynamo.scan({ TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME }).promise();
    await Promise.all(users.map(async (user) => {
        let formattedMeetings = { zoomMeetings: { meetings: [] } };
        dbResult.Items.forEach((meeting) => {
            let invitedList = new Array();
            invitedList = meeting.invitedUsers;
            if ((invitedList === null || invitedList === void 0 ? void 0 : invitedList.includes(user.UserID)) || Number(meeting.hostRank) <= user.rank) {
                formattedMeetings.zoomMeetings.meetings.push({
                    id: meeting.MeetingID,
                    topic: meeting.topic,
                    url: meeting.url,
                    members: meeting.members
                });
            }
        });
        await sendUserMessage(user.connectionId, formattedMeetings);
    }));
};
const handler = async (event) => {
    var _a, _b;
    try {
        if (event.requestContext) {
            // get websocket connection information
            const connectionId = event.requestContext.connectionId;
            const routeKey = event.requestContext.routeKey;
            let body = {};
            if (event.body) {
                body = JSON.parse(event.body);
            }
            let hookBody = body.body;
            let dbResult;
            let formattedMeetings;
            console.log("Webhook Handler: ", hookBody, routeKey);
            // switch statement depending on which hook is recieved
            switch (routeKey) {
                case '$connect':
                    if (connectionId) {
                        // add connectionId to the list of cached connected users
                        if (connected_users.filter((user) => user == connectionId).length == 0) {
                            connected_users.push(connectionId);
                        }
                        // add connectionId to the database for the user
                        if (event.requestContext.authorizer) {
                            let userId = event.requestContext.authorizer.principalId;
                            let newConnectionMessage = {
                                TableName: constants_1.dbInfo.USER_TABLE_NAME,
                                Key: { UserID: String(userId) },
                                UpdateExpression: "set connectionId = :val1",
                                ExpressionAttributeValues: {
                                    ":val1": connectionId,
                                },
                            };
                            dbResult = await dynamo.update(newConnectionMessage).promise();
                        }
                    }
                    break;
                case 'userJoinedMeeting':
                    // if the meeting hasn't started yet, add it to the db
                    const joinedMeetingInDb = await isMeetingInDatabse(hookBody.object.id);
                    if (!joinedMeetingInDb) {
                        // need to get meeting details from zoom
                        let joinedMeetingDetails = await getMeetingDetailsFromZoom(hookBody.object.id);
                        // find host rank from host_emil
                        let joinedHostRank = "0";
                        let joinedRankQuery = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            FilterExpression: "zoomId = :zoomid",
                            KeyConditionExpression: "UserID = :userid",
                            ExpressionAttributeValues: {
                                ":zoomid": String(joinedMeetingDetails.host_email)
                            }
                        };
                        dbResult = await dynamo.scan(joinedRankQuery).promise();
                        if (dbResult.Items[0]) {
                            joinedHostRank = dbResult.Items[0].rank;
                        }
                        let meetingEntry = {
                            TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                            Item: {
                                MeetingID: String(hookBody.object.id),
                                topic: joinedMeetingDetails.topic,
                                url: joinedMeetingDetails.join_url,
                                hostRank: joinedHostRank,
                                invitedUsers: [],
                                members: []
                            }
                        };
                        dbResult = await dynamo.put(meetingEntry).promise();
                    }
                    let joinQuery = {
                        TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                        KeyConditionExpression: "MeetingID = :meetingid",
                        ExpressionAttributeValues: {
                            ":meetingid": hookBody.object.id
                        }
                    };
                    dbResult = await dynamo.query(joinQuery).promise();
                    let queryMembers = dbResult.Items[0].members;
                    // add current user to queryMembers
                    if (queryMembers.filter((member) => member == hookBody.object.participant.user_name).length == 0) {
                        queryMembers.push(hookBody.object.participant.user_name);
                    }
                    // get UserId from zoom email
                    let userIdQuery = {
                        TableName: constants_1.dbInfo.USER_TABLE_NAME,
                        FilterExpression: "zoomId = :zoomid",
                        KeyConditionExpression: "UserID = :userid",
                        ExpressionAttributeValues: {
                            ":zoomid": String(hookBody.object.participant.email)
                        }
                    };
                    dbResult = await dynamo.scan(userIdQuery).promise();
                    let userJoinKey = (_a = dbResult.Items[0]) === null || _a === void 0 ? void 0 : _a.UserID;
                    // update user location
                    if (userJoinKey != undefined || userJoinKey != null) {
                        let updateUserLocationJoin = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            Key: { UserID: userJoinKey },
                            UpdateExpression: "set #loc = :val1",
                            ExpressionAttributeValues: {
                                ":val1": hookBody.object.id,
                            },
                            ExpressionAttributeNames: {
                                "#loc": "location"
                            },
                        };
                        dbResult = await dynamo.update(updateUserLocationJoin).promise();
                    }
                    // update active meeting
                    let userJoinedMessage = {
                        TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                        Key: { MeetingID: String(hookBody.object.id) },
                        UpdateExpression: "set members = :val1",
                        ExpressionAttributeValues: {
                            ":val1": queryMembers,
                        },
                    };
                    dbResult = await dynamo.update(userJoinedMessage).promise();
                    // if the meeting is scheduled, update its participantsJoined
                    if (hookBody.object.type != MeetingType.Instant) {
                        // send emails to users that have not yet joined the meeting
                        const smeeting = await getZoomMeetingData(hookBody.object.id);
                        let queryParticipants = smeeting.participantsJoined;
                        // add current user to queryParticipants
                        if (queryParticipants.filter((part) => part == userJoinKey).length == 0) {
                            queryParticipants.push(userJoinKey);
                        }
                        // add the current user to the meetings participantsJoined
                        let participantsJoinedMessage = {
                            TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
                            Key: { MeetingID: String(hookBody.object.id) },
                            UpdateExpression: "set participantsJoined = :val1",
                            ExpressionAttributeValues: {
                                ":val1": queryParticipants,
                            },
                        };
                        dbResult = await dynamo.update(participantsJoinedMessage).promise();
                    }
                    await sendUpdatedActiveMeetings();
                    break;
                case 'userLeftMeeting':
                    let userEmail = hookBody.object.participant.email;
                    if (userEmail == 0) {
                        // get user info from zoom
                        const userResult = await getUserDetailsFromZoom(hookBody.object.participant.id);
                        userEmail = userResult.email;
                    }
                    // get UserId from zoom email
                    let userLeftIdQuery = {
                        TableName: constants_1.dbInfo.USER_TABLE_NAME,
                        FilterExpression: "zoomId = :zoomid",
                        KeyConditionExpression: "UserID = :userid",
                        ExpressionAttributeValues: {
                            ":zoomid": String(userEmail)
                        }
                    };
                    dbResult = await dynamo.scan(userLeftIdQuery).promise();
                    let userLeftKey = (_b = dbResult.Items[0]) === null || _b === void 0 ? void 0 : _b.UserID;
                    // update user location
                    if (userLeftKey != undefined || userLeftKey != null) {
                        let updateUserLocationJoin = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            Key: { UserID: userLeftKey },
                            UpdateExpression: "set #loc = :val1",
                            ExpressionAttributeValues: {
                                ":val1": "",
                            },
                            ExpressionAttributeNames: {
                                "#loc": "location"
                            },
                        };
                        dbResult = await dynamo.update(updateUserLocationJoin).promise();
                    }
                    let leftQuery = {
                        TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                        KeyConditionExpression: "MeetingID = :meetingid",
                        ExpressionAttributeValues: {
                            ":meetingid": hookBody.object.id
                        }
                    };
                    dbResult = await dynamo.query(leftQuery).promise();
                    if (dbResult.Items[0]) {
                        let queryLeftMembers = dbResult.Items[0].members;
                        // remove user from queryLeftMembers
                        queryLeftMembers = queryLeftMembers.filter((member) => member != hookBody.object.participant.user_name);
                        if (queryLeftMembers.length == 0) {
                            // if the meeting is empty, remove it from the db
                            let deleteEntry = {
                                TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                                Key: { MeetingID: String(hookBody.object.id) }
                            };
                            dbResult = await dynamo.delete(deleteEntry).promise();
                        }
                        else {
                            // update the meeting's users
                            let userLeftMessage = {
                                TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                                Key: { MeetingID: String(hookBody.object.id) },
                                UpdateExpression: "set members = :val1",
                                ExpressionAttributeValues: {
                                    ":val1": queryLeftMembers,
                                },
                            };
                            dbResult = await dynamo.update(userLeftMessage).promise();
                        }
                        await sendUpdatedActiveMeetings();
                    }
                    break;
                case 'meetingCreated':
                    if (hookBody.object.type == MeetingType.Scheduled) {
                        const meetingID = hookBody.object.id.toString();
                        const topic = hookBody.object.topic;
                        const url = hookBody.object.join_url;
                        const startTime = hookBody.object.start_time;
                        const duration = hookBody.object.duration;
                        let timezone = hookBody.object.timezone;
                        const hostId = hookBody.operator;
                        // Check if meeting already exists in our db, if so break
                        const params = {
                            TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
                            Key: {
                                MeetingID: meetingID
                            },
                            AttributesToGet: [
                                'startDate',
                                'endDate'
                            ]
                        };
                        const results = await dynamo.get(params).promise();
                        if (results && results.Item && results.Item.startDate) {
                            break;
                        }
                        // Get userID using zoomid as a GSI
                        let userId = '';
                        let username = '';
                        const getUserIDparams = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            IndexName: 'ZoomGSI',
                            KeyConditionExpression: 'zoomId = :zoomid',
                            ExpressionAttributeValues: {
                                ':zoomid': hostId
                            }
                        };
                        const dbresult = await dynamo.query(getUserIDparams).promise();
                        if (dbresult && dbresult.Items && dbresult.Items[0] && dbresult.Items[0].UserID) {
                            userId = dbresult.Items[0].UserID;
                            username = dbresult.Items[0].name;
                        }
                        if (userId == '') {
                            break;
                        }
                        console.log(userId);
                        if (!timezone || timezone == '') {
                            timezone = 'UTC';
                        }
                        let startDate;
                        let endDate;
                        if (startTime.charAt(10) === 'T' && startTime.charAt(19) === 'Z') {
                            startDate = startTime;
                            endDate = new tc.DateTime(startTime).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z';
                        }
                        else {
                            startDate = convertTimeZone(startTime, timezone).toUtcString().substring(0, 19) + 'Z';
                            endDate = convertTimeZone(startTime, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z';
                        }
                        const createScheduledMeetingParams = {
                            TableName: constants_1.dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
                            Item: {
                                MeetingID: meetingID,
                                link: url,
                                title: topic,
                                startDate: startDate,
                                endDate: endDate,
                                participants: [{ UserID: userId, name: username }],
                                participantsJoined: []
                            }
                        };
                        await dynamo.put(createScheduledMeetingParams).promise();
                        const addToUserScheduledMeetingsParams = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            Key: { UserID: userId },
                            UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
                            ExpressionAttributeNames: { '#a': 'scheduledMeetings' },
                            ExpressionAttributeValues: {
                                ':x': [meetingID],
                                ':empty_list': []
                            },
                            ReturnValues: "UPDATED_NEW"
                        };
                        await dynamo.update(addToUserScheduledMeetingsParams).promise();
                    }
                    // Schedule notifications
                    // TODO: add scheduled meeting to db
                    break;
                // case 'meetingDeleted':
                //   // TODO: remove scheduled meeting from db
                //   break;
                // case 'meetingUpdated':
                //   // TODO: update scheduled meeting in db (date/time/participants)
                //   break;
                case 'meetingStarted':
                    console.log('meetingStarted');
                    // don't notify for instant meetings (it's handled in create-meeting)
                    let scheduledParticipants = new Array();
                    if (hookBody.object.type != MeetingType.Instant) {
                        const meetingId = hookBody.object.id;
                        const meetingData = await getZoomMeetingData(meetingId);
                        for (const participant of meetingData.participants) {
                            const user = await getUser(participant.UserID);
                            // don't send to host they get notified from the notification event
                            if (user.zoomId != hookBody.object.host_id) {
                                // add user to list of people not to filter by rank
                                scheduledParticipants.push(user.UserID);
                                // sendUserMessage(user.connectionId, {
                                //   incomingCall: { topic: hookBody.object.topic, url: meetingData.link, host: false, scheduled: true }
                                // });
                            }
                        }
                    }
                    // only add the meeting if it has not already been added
                    const startedMeetingInDb = await isMeetingInDatabse(hookBody.object.id);
                    if (!startedMeetingInDb) {
                        // need to get meeting details from zoom
                        let meetingDetails = await getMeetingDetailsFromZoom(hookBody.object.id);
                        // find host rank from host_emil
                        let hostRank = "0";
                        let startedRankQuery = {
                            TableName: constants_1.dbInfo.USER_TABLE_NAME,
                            FilterExpression: "zoomId = :zoomid",
                            KeyConditionExpression: "UserID = :userid",
                            ExpressionAttributeValues: {
                                ":zoomid": String(meetingDetails.host_email)
                            }
                        };
                        dbResult = await dynamo.scan(startedRankQuery).promise();
                        if (dbResult.Items[0]) {
                            hostRank = dbResult.Items[0].rank;
                        }
                        let meetingEntry = {
                            TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                            Item: {
                                MeetingID: String(hookBody.object.id),
                                topic: meetingDetails.topic,
                                url: meetingDetails.join_url,
                                hostRank: hostRank,
                                invitedUsers: scheduledParticipants,
                                members: []
                            }
                        };
                        dbResult = await dynamo.put(meetingEntry).promise();
                    }
                    await sendUpdatedActiveMeetings();
                    // email participants for scheduled meetings if they haven't joined after 2 minutes
                    if (hookBody.object.type != MeetingType.Instant) {
                        // wait 2 mins (TODO: change this to be a lambda step function)
                        await sleep(60000);
                        // send emails to users that have not yet joined the meeting
                        const smeeting = await getZoomMeetingData(hookBody.object.id);
                        // only send emails if needed
                        if (smeeting.participantsJoined.length < smeeting.participants.length) {
                            const transporter = nodemailer.createTransport({
                                host: 'smtp.gmail.com',
                                port: 465,
                                secure: true,
                                auth: {
                                    user: process.env.NOTIF_EMAIL,
                                    pass: process.env.NOTIF_EMAIL_PASSWORD
                                }
                            });
                            let participantsToSend = new Array();
                            smeeting.participants.forEach((p) => {
                                let joined = false;
                                smeeting.participantsJoined.forEach((pj) => {
                                    if (p.UserID == pj) {
                                        joined = true;
                                    }
                                });
                                if (!joined) {
                                    participantsToSend.push(p.UserID);
                                }
                            });
                            // send the email to each required participant
                            await Promise.all(participantsToSend.map(async (participant) => {
                                let userQuery = {
                                    TableName: constants_1.dbInfo.USER_TABLE_NAME,
                                    KeyConditionExpression: "UserID = :userid",
                                    ExpressionAttributeValues: {
                                        ":userid": participant
                                    }
                                };
                                const dbResult = await dynamo.query(userQuery).promise();
                                const participantInfo = dbResult.Items[0];
                                if (participantInfo) {
                                    const mailOptions = {
                                        from: process.env.NOTIF_EMAIL,
                                        to: participantInfo.zoomId,
                                        subject: 'Missed scheduled meeting: ' + smeeting.title,
                                        text: 'The scheduled meeting: ' + smeeting.title + ' you were invited to attend started 2 minutes ago. Please check back after the scheduled end-time for a recording.'
                                    };
                                    await transporter.sendMail(mailOptions, function (error, data) {
                                        if (error) {
                                            console.log(error);
                                        }
                                        else {
                                            console.log('Email sent: ' + data.response);
                                        }
                                    });
                                }
                            }));
                        }
                    }
                    break;
                case 'meetingEnded':
                    let deleteEntry = {
                        TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                        Key: { MeetingID: String(hookBody.object.id) }
                    };
                    dbResult = await dynamo.delete(deleteEntry).promise();
                    await sendUpdatedActiveMeetings();
                    // TODO: remove scheduled meeting from db
                    break;
                default:
                    console.log("Unexpected action received: " + hookBody);
                    break;
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ data: 'hello from zoomWebhooks' }),
        };
    }
    catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: "ZOOM WEBHOOKS ERROR",
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBMEI7QUFDMUIsMkNBQXFDO0FBT3JDLElBQUssV0FRSjtBQVJELFdBQUssV0FBVztJQUNkLDZEQUFnQixDQUFBO0lBQ2hCLG1EQUFPLENBQUE7SUFDUCx1REFBUyxDQUFBO0lBQ1QsdURBQVMsQ0FBQTtJQUNULHFEQUFRLENBQUE7SUFDUiwyQ0FBRyxDQUFBO0lBQ0gsaUVBQWMsQ0FBQTtBQUNoQixDQUFDLEVBUkksV0FBVyxLQUFYLFdBQVcsUUFRZjtBQUVELElBQUssWUFJSjtBQUpELFdBQUssWUFBWTtJQUNmLG1EQUFtQyxDQUFBO0lBQ25DLDJDQUEyQixDQUFBO0lBQzNCLDJDQUEyQixDQUFBO0FBQzdCLENBQUMsRUFKSSxZQUFZLEtBQVosWUFBWSxRQUloQjtBQUVELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQixNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDcEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3pDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBR3ZDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUU3RixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBR3BELE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFD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