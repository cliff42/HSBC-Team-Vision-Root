import axios from "axios";
import { dbInfo } from "./constants";
import type {
  APIGatewayProxyResult,
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
} from "aws-lambda";

enum MeetingType {
  Prescheduled = 0,
  Instant,
  Scheduled,
  Recurring,
  Personal,
  PAC,
  RecurringFixed
}

enum Notification {
  MeetingStarting = "MeetingStarting",
  MeetingIn15 = "MeetingIn15",
  MeetingIn30 = "MeetingIn30"
}

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
}
const zoomToken = jwt.sign(zoomPayload, ZOOM_API_SECRET);

const sendZoomAPICall = (URL: string, queryParameters: any) => {
  return new Promise((resolve, reject) => {
    const path: string = 'https://api.zoom.us/v2/' + URL;
    axios.post(path, queryParameters, { headers: { 'Authorization': `Bearer ${zoomToken}` }})
    .then(function (res) {
      resolve(res.data);
    })
    .catch(function (err) {
      console.log(err);
      reject(err);
    });
  });
}

const getZoomMeetingData = (meetingId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    dynamo.query({
        TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
        KeyConditionExpression : "MeetingID = :id",
        ExpressionAttributeValues: {
          ":id": meetingId
        }
    }, function(error: any, data: any) {
      if(!error) {
        data.Items?.forEach(function(item: any) {
          if(item.MeetingID == meetingId) {
            // return the meeting
            resolve(item);
          }
        });
      }
      reject("No meeting found with MeetingId: " + meetingId);
    });
  });
}

const getMeetingDetailsFromZoom = (meetingId: string): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    let path: string = 'https://api.zoom.us/v2/meetings/' + meetingId;

    let res = await axios.get(path, {headers: {'Authorization': `Bearer ${zoomToken}`}});
    if (res) {
      resolve(res.data);
    } else {
      reject("Error getting meeting details from zoom");
    }
  });
}

const getUserDetailsFromZoom = (userId: string): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    let path: string = 'https://api.zoom.us/v2/users/' + userId;

    let res = await axios.get(path, {headers: {'Authorization': `Bearer ${zoomToken}`}});
    if (res) {
      resolve(res.data);
    } else {
      reject("Error getting user details from zoom");
    }
  });
}

const convertTimeZone = (originalTime: any, timezone: string) => {
    const timeInOriginalTimezone = new tc.DateTime(originalTime, tc.zone(timezone));
    return timeInOriginalTimezone.convert(tc.zone("UTC"));
}

const isMeetingInDatabse = (meetingId: string): Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    let joinedMeetingQuery = {
      TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
        KeyConditionExpression: "MeetingID = :meetingid",
        ExpressionAttributeValues: {
          ":meetingid": String(meetingId)
        }
    }
          
    const dbResult = await dynamo.query(joinedMeetingQuery).promise();

    if (!dbResult.Items) {
      reject("error reaching DB");
    }
          
    // true if query yeilds more than 0 results
    if (dbResult.Items.length > 0) {
      resolve(true);                  
    } else {
      resolve(false);
    }
  }); 
}

const getUser = (userId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    dynamo.query({
        TableName: 'UserData',
        KeyConditionExpression : "UserID = :id",
        ExpressionAttributeValues: {
          ":id": userId
        }
    }, function(error: any, data: any) {
      if(!error) {
        data.Items?.forEach(function(item: any) {
          if(item.UserID == userId) {
            // return the user
            resolve(item);
          }
        });
      }
      reject("No user found with UserId: " + userId);
    });
  });
}

const getUserRankFromId = (userId: string): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    let userQuery = {
      TableName: dbInfo.USER_TABLE_NAME,
      KeyConditionExpression: "UserID = :userid",
      ExpressionAttributeValues: {
          ":userid": userId
      }
    }

    let dbResult = await dynamo.query(userQuery).promise();

    if (dbResult.Items[0]) {
      // get rank from userId
      resolve(Number(dbResult.Items[0].rank));
    } else {
      reject("error getting rank for userId");
    }
  });
}

const sendAllUsersMessage = async(users: any, body: any) => {
  const all = users.map((user: any) => sendUserMessage(user.connectionId, body));
  return Promise.all(all);
};

// cached list of connected users
let connected_users: Array<string> = new Array();

const sendAllConnectedUsersMessage = async(ids: Array<string>, body: any) => {
  const all = ids.map(id => sendUserMessage(id, body));
  return Promise.all(all);
};


const sendUserMessage = async(id: any, body: any) => {
  try {
      await client.postToConnection({
          'ConnectionId': id,
          'Data': Buffer.from(JSON.stringify(body)),
      }).promise();
  } catch (err) {
      console.log(err);
  }
}

// sends updated list of active meetings to all connected users
const sendUpdatedActiveMeetings = async() => {
  // need to send correct meetings for each user
  // get all connectionIds from userDb
  let dbResult = await dynamo.scan({ TableName: dbInfo.USER_TABLE_NAME }).promise();
  const users: any = dbResult.Items;

  // send updated list of meetings to all users
  dbResult = await dynamo.scan({ TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME }).promise();

  await Promise.all(users.map(async (user: any) => {
    let formattedMeetings: any = {zoomMeetings: {meetings: []}};

    dbResult.Items.forEach((meeting : any) => {
      let invitedList: Array<string> = new Array();
      invitedList = meeting.invitedUsers;

      if (invitedList?.includes(user.UserID) || Number(meeting.hostRank) <= user.rank) {
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
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (event.requestContext) {
      // get websocket connection information
      const connectionId = event.requestContext.connectionId;
      const routeKey = event.requestContext.routeKey;

      let body: any = {};
      if (event.body) {
          body = JSON.parse(event.body);
      }
      let hookBody = body.body;
      let dbResult: any;
      let formattedMeetings: any;

      console.log("Webhook Handler: ", hookBody, routeKey);
      // switch statement depending on which hook is recieved
      switch(routeKey) {
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
                TableName: dbInfo.USER_TABLE_NAME,
                Key: {UserID: String(userId)},
                UpdateExpression: "set connectionId = :val1",
                ExpressionAttributeValues: {
                    ":val1": connectionId,
                },
              }
            
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
              let joinedHostRank: string = "0";

              let joinedRankQuery = {
                TableName: dbInfo.USER_TABLE_NAME,
                FilterExpression: "zoomId = :zoomid",
                KeyConditionExpression: "UserID = :userid",
                ExpressionAttributeValues: {
                    ":zoomid": String(joinedMeetingDetails.host_email)
                }
              }
    
              dbResult = await dynamo.scan(joinedRankQuery).promise();

              if (dbResult.Items[0]) {
                joinedHostRank = dbResult.Items[0].rank;
              }

              let meetingEntry = {
                  TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                  Item: {
                      MeetingID: String(hookBody.object.id),
                      topic: joinedMeetingDetails.topic,
                      url: joinedMeetingDetails.join_url,
                      hostRank: joinedHostRank,
                      invitedUsers: [],
                      members: []
                  }
              }

              dbResult = await dynamo.put(meetingEntry).promise();                    
          }

          let joinQuery = {
              TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
              KeyConditionExpression: "MeetingID = :meetingid",
              ExpressionAttributeValues: {
                  ":meetingid": hookBody.object.id
              }
          }
          
          dbResult = await dynamo.query(joinQuery).promise();
          let queryMembers = dbResult.Items[0].members;
          
          // add current user to queryMembers
          if (queryMembers.filter((member: any) => member == hookBody.object.participant.user_name).length == 0) {
              queryMembers.push(hookBody.object.participant.user_name);
          }

          // get UserId from zoom email
          let userIdQuery = {
            TableName: dbInfo.USER_TABLE_NAME,
            FilterExpression: "zoomId = :zoomid",
            KeyConditionExpression: "UserID = :userid",
            ExpressionAttributeValues: {
                ":zoomid": String(hookBody.object.participant.email)
            }
          }

          dbResult = await dynamo.scan(userIdQuery).promise();
          let userJoinKey: string = dbResult.Items[0]?.UserID;

          // update user location
          if (userJoinKey != undefined || userJoinKey != null) {
            let updateUserLocationJoin = {
              TableName: dbInfo.USER_TABLE_NAME,
              Key: {UserID: userJoinKey},
              UpdateExpression: "set #loc = :val1",
              ExpressionAttributeValues: {
                  ":val1": hookBody.object.id,
              },
              ExpressionAttributeNames: {
                  "#loc": "location"
              },
            }
          
            dbResult = await dynamo.update(updateUserLocationJoin).promise();
          }

          // update active meeting
          let userJoinedMessage = {
              TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
              Key: {MeetingID: String(hookBody.object.id)},
              UpdateExpression: "set members = :val1",
              ExpressionAttributeValues: {
                  ":val1": queryMembers,
              },
          }
          
          dbResult = await dynamo.update(userJoinedMessage).promise();

          // if the meeting is scheduled, update its participantsJoined
          if (hookBody.object.type as MeetingType != MeetingType.Instant) {
            // send emails to users that have not yet joined the meeting
            const smeeting = await getZoomMeetingData(hookBody.object.id);

            let queryParticipants = smeeting.participantsJoined;

            // add current user to queryParticipants
            if (queryParticipants.filter((part: string) => part == userJoinKey).length == 0) {
              queryParticipants.push(userJoinKey);
            } 

            // add the current user to the meetings participantsJoined
            let participantsJoinedMessage = {
              TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
              Key: {MeetingID: String(hookBody.object.id)},
              UpdateExpression: "set participantsJoined = :val1",
              ExpressionAttributeValues: {
                  ":val1": queryParticipants,
              },
            }
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
            TableName: dbInfo.USER_TABLE_NAME,
            FilterExpression: "zoomId = :zoomid",
            KeyConditionExpression: "UserID = :userid",
            ExpressionAttributeValues: {
                ":zoomid": String(userEmail)
            }
          }

          dbResult = await dynamo.scan(userLeftIdQuery).promise();
          let userLeftKey: string = dbResult.Items[0]?.UserID;

          // update user location
          if (userLeftKey != undefined || userLeftKey != null) {
            let updateUserLocationJoin = {
              TableName: dbInfo.USER_TABLE_NAME,
              Key: {UserID: userLeftKey},
              UpdateExpression: "set #loc = :val1",
              ExpressionAttributeValues: {
                  ":val1": "",
              },
              ExpressionAttributeNames: {
                  "#loc": "location"
              },
            }
          
            dbResult = await dynamo.update(updateUserLocationJoin).promise();
          }

          let leftQuery = {
              TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
              KeyConditionExpression: "MeetingID = :meetingid",
              ExpressionAttributeValues: {
                  ":meetingid": hookBody.object.id
              }
          }
          
          dbResult = await dynamo.query(leftQuery).promise();

          if (dbResult.Items[0]) {
            let queryLeftMembers = dbResult.Items[0].members;
          
            // remove user from queryLeftMembers
            queryLeftMembers = queryLeftMembers.filter((member: any) => member != hookBody.object.participant.user_name)
  
            if (queryLeftMembers.length == 0) {
              // if the meeting is empty, remove it from the db
              let deleteEntry = {
                TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                Key: {MeetingID: String(hookBody.object.id)}
              }
            
              dbResult = await dynamo.delete(deleteEntry).promise();
            } else {
              // update the meeting's users
              let userLeftMessage = {
                TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                Key: {MeetingID: String(hookBody.object.id)},
                UpdateExpression: "set members = :val1",
                ExpressionAttributeValues: {
                    ":val1": queryLeftMembers,
                },
              }
            
              dbResult = await dynamo.update(userLeftMessage).promise();
            }
            
            await sendUpdatedActiveMeetings();   
          }
          break;
        case 'meetingCreated':
            if (hookBody.object.type as MeetingType == MeetingType.Scheduled) {
                const meetingID = hookBody.object.id.toString();
                const topic = hookBody.object.topic;
                const url = hookBody.object.join_url;
                const startTime= hookBody.object.start_time;
                const duration = hookBody.object.duration;
                let timezone = hookBody.object.timezone;
                const hostId = hookBody.operator;
                // Check if meeting already exists in our db, if so break
                const params = {
                    TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
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
                    TableName: dbInfo.USER_TABLE_NAME,
                    IndexName: 'ZoomGSI',
                    KeyConditionExpression: 'zoomId = :zoomid',
                    ExpressionAttributeValues: {
                        ':zoomid': hostId
                    }
                }
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
                } else {
                    startDate = convertTimeZone(startTime, timezone).toUtcString().substring(0, 19) + 'Z';
                    endDate = convertTimeZone(startTime, timezone).add(duration, tc.TimeUnit.Minute).toUtcString().substring(0, 19) + 'Z';
                }
                const createScheduledMeetingParams = {
                    TableName: dbInfo.SCHEDULED_MEETINGS_TABLE_NAME,
                    Item: {
                        MeetingID: meetingID,
                        link: url,
                        title: topic,
                        startDate: startDate,
                        endDate: endDate,
                        participants: [{UserID: userId, name: username}],
                        participantsJoined: []
                    }
                };
                await dynamo.put(createScheduledMeetingParams).promise();
                const addToUserScheduledMeetingsParams = {
                    TableName: dbInfo.USER_TABLE_NAME,
                    Key: {UserID: userId},
                    UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
                    ExpressionAttributeNames: {'#a': 'scheduledMeetings'},
                    ExpressionAttributeValues: {
                        ':x': [meetingID],
                        ':empty_list' : []
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
         let scheduledParticipants: Array<string> = new Array();
          if(hookBody.object.type as MeetingType != MeetingType.Instant) {
            const meetingId = hookBody.object.id;
            const meetingData = await getZoomMeetingData(meetingId);
            for(const participant of meetingData.participants) {
              const user = await getUser(participant.UserID)
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
              let hostRank: string = "0";

              let startedRankQuery = {
                TableName: dbInfo.USER_TABLE_NAME,
                FilterExpression: "zoomId = :zoomid",
                KeyConditionExpression: "UserID = :userid",
                ExpressionAttributeValues: {
                    ":zoomid": String(meetingDetails.host_email)
                }
              }
    
              dbResult = await dynamo.scan(startedRankQuery).promise();

              if (dbResult.Items[0]) {
                hostRank = dbResult.Items[0].rank;
              }

              let meetingEntry = {
                  TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                  Item: {
                      MeetingID: String(hookBody.object.id),
                      topic: meetingDetails.topic,
                      url: meetingDetails.join_url,
                      hostRank: hostRank,
                      invitedUsers: scheduledParticipants,
                      members: []
                  }
              }

              dbResult = await dynamo.put(meetingEntry).promise();                    
          }

          await sendUpdatedActiveMeetings();

          // email participants for scheduled meetings if they haven't joined after 2 minutes
          if (hookBody.object.type as MeetingType != MeetingType.Instant) {
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

              let participantsToSend: Array<any> = new Array();
              
              smeeting.participants.forEach((p: any) => {
                let joined = false;
                smeeting.participantsJoined.forEach((pj: any) => {
                  if (p.UserID == pj) {
                    joined = true;
                  }
                });
                if (!joined) {
                  participantsToSend.push(p.UserID);
                }
              });

              // send the email to each required participant
              await Promise.all(participantsToSend.map(async (participant: string) => {
                let userQuery = {
                  TableName: dbInfo.USER_TABLE_NAME,
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
                  
                  await transporter.sendMail(mailOptions, function(error: any, data: any){
                    if (error) {
                      console.log(error);
                    } else {
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
            TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
            Key: {MeetingID: String(hookBody.object.id)}
          }
        
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
      body: JSON.stringify({data: 'hello from zoomWebhooks'}),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "ZOOM WEBHOOKS ERROR",
    };
  }
};
