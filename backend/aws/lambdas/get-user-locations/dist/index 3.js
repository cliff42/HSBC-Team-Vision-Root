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
            const body = JSON.parse(event.body || "{}");
            let userLocations = new Array();
            // get the rank of the connected user
            let connectedUserId = "";
            let connectedRank = 0;
            if (event.requestContext.authorizer) {
                connectedUserId = event.requestContext.authorizer.principalId;
            }
            let userQuery = {
                TableName: constants_1.dbInfo.USER_TABLE_NAME,
                KeyConditionExpression: "UserID = :userid",
                ExpressionAttributeValues: {
                    ":userid": connectedUserId
                }
            };
            let dbResult = await dynamo.query(userQuery).promise();
            if (dbResult.Items[0]) {
                // get rank from currently logged-in user
                connectedRank = Number(dbResult.Items[0].rank);
            }
            await Promise.all(body.body.users.map(async (user) => {
                let userQuery = {
                    TableName: constants_1.dbInfo.USER_TABLE_NAME,
                    KeyConditionExpression: "UserID = :userid",
                    ExpressionAttributeValues: {
                        ":userid": user
                    }
                };
                let dbResult = await dynamo.query(userQuery).promise();
                const locationId = dbResult.Items[0]['location'];
                const rank = dbResult.Items[0]['rank'];
                let loc = "";
                // get meeting name from id
                if (locationId && locationId.length !== 0) {
                    // only need to get meeting name if the user has a lower rank than the connected user
                    if (Number(rank) <= connectedRank) {
                        let meetingQuery = {
                            TableName: constants_1.dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                            KeyConditionExpression: "MeetingID = :meetingid",
                            ExpressionAttributeValues: {
                                ":meetingid": locationId
                            }
                        };
                        dbResult = await dynamo.query(meetingQuery).promise();
                        if (dbResult.Items[0] && dbResult.Items[0].topic) {
                            loc = dbResult.Items[0].topic;
                        }
                    }
                    else {
                        loc = "restricted";
                    }
                }
                userLocations.push({
                    UserId: user,
                    location: loc
                });
            }));
            await sendUserMessage(connectionId, { userLocations: userLocations });
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ data: 'hello from getUsers' }),
        };
    }
    catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: "GET USERS MEETINGS ERROR",
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwyQ0FBcUM7QUFPckMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRS9CLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUU3RixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUMsRUFBTyxFQUFFLElBQVMsRUFBRSxFQUFFO0lBQ2xELElBQUk7UUFDQSxNQUFNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxQixjQUFjLEVBQUUsRUFBRTtZQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNoQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNwQjtBQUNILENBQUMsQ0FBQTtBQUVNLE1BQU0sT0FBTyxHQUEyQixLQUFLLEVBQ2xELEtBQTJCLEVBQ0ssRUFBRTtJQUNsQyxJQUFJO1FBQ0YsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFO1lBQ3hCLHVDQUF1QztZQUN2QyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztZQUN2RCxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztZQUMvQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksSUFB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