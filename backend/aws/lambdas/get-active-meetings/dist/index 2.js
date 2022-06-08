"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const constants_1 = require("./constants");
const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
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
    try {
        if (event.requestContext) {
            // get websocket connection information
            const connectionId = event.requestContext.connectionId;
            const routeKey = event.requestContext.routeKey;
            const body = JSON.parse("{}" || event.body);
            let mainId = 'me';
            let path = '/v2/users/' + mainId + '/meetings';
            let userId = "";
            let userRank = 0;
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
            if (dbResult.Items[0]) {
                // get rank from currently logged-in user
                userRank = Number(dbResult.Items[0].rank);
            }
            dbResult = await dynamo.scan({ TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME }).promise();
            let formattedMeetings = { zoomMeetings: { meetings: [] } };
            if (dbResult.Items != null && dbResult.Items != []) {
                dbResult.Items.forEach((meeting) => {
                    let invitedList = new Array();
                    invitedList = meeting.invitedUsers;
                    // only show meetings that the user has authority to see
                    if ((invitedList === null || invitedList === void 0 ? void 0 : invitedList.includes(userId)) || Number(meeting.hostRank) <= userRank) {
                        formattedMeetings.zoomMeetings.meetings.push({
                            id: meeting.MeetingID,
                            topic: meeting.topic,
                            url: meeting.url,
                            members: meeting.members
                        });
                    }
                });
            }
            await sendUserMessage(connectionId, formattedMeetings);
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ data: 'hello from getActiveMeetings' }),
        };
    }
    catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: "GET ACTIVE MEETINGS ERROR",
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwyQ0FBcUM7QUFPckMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRS9CLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUU3RixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUMsRUFBTyxFQUFFLElBQVMsRUFBRSxFQUFFO0lBQ2xELElBQUk7UUFDQSxNQUFNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxQixjQUFjLEVBQUUsRUFBRTtZQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNoQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNwQjtBQUNILENBQUMsQ0FBQTtBQUVNLE1BQU0sT0FBTyxHQUEyQixLQUFLLEVBQ2xELEtBQTJCLEVBQ0ssRUFBRTtJQUNsQyxJQUFJO1FBQ0YsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFO1lBQ3hCLHVDQUF1QztZQUN2QyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztZQUN2RCxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztZQUMvQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFB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