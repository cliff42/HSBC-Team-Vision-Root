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
            let userId = "";
            if (event.requestContext.authorizer) {
                userId = event.requestContext.authorizer.principalId;
            }
            if (userId.length > 0) {
                let dbQuery = {
                    TableName: constants_1.dbInfo.USER_TABLE_NAME,
                    KeyConditionExpression: "UserID = :userid",
                    ExpressionAttributeValues: {
                        ":userid": userId
                    }
                };
                const dbResult = await dynamo.query(dbQuery).promise();
                if (dbResult.Items[0]) {
                    let profile = {};
                    const user = dbResult.Items[0];
                    profile.name = user.name;
                    profile.email = user.zoomId;
                    profile.imageUrl = user.imageUrl;
                    switch (Number(user.rank)) {
                        case 0:
                            profile.rank = "Junior Sales Associate";
                            break;
                        case 1:
                            profile.rank = "Software Engineer";
                            break;
                        case 2:
                            profile.rank = "Team Lead";
                            break;
                        case 3:
                            profile.rank = "Senior Manager";
                            break;
                        case 4:
                            profile.rank = "Vice President";
                            break;
                        case 5:
                            profile.rank = "CEO";
                            break;
                        default:
                            profile.rank = "Employee";
                    }
                    await sendUserMessage(connectionId, { profileInfo: profile });
                }
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ data: 'hello from getProfileInfo' }),
        };
    }
    catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: "GET PROFILE INFO ERROR",
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwyQ0FBcUM7QUFPckMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRS9CLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUU3RixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUMsRUFBTyxFQUFFLElBQVMsRUFBRSxFQUFFO0lBQ2xELElBQUk7UUFDQSxNQUFNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxQixjQUFjLEVBQUUsRUFBRTtZQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNoQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNwQjtBQUNILENBQUMsQ0FBQTtBQUVNLE1BQU0sT0FBTyxHQUEyQixLQUFLLEVBQ2xELEtBQTJCLEVBQ0ssRUFBRTtJQUNsQyxJQUFJO1FBQ0YsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFO1lBQ3hCLHVDQUF1QztZQUN2QyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztZQUN2RCxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztZQUMvQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksSUFB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