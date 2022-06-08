import { dbInfo } from "./constants";
import type {
  APIGatewayProxyResult,
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
} from "aws-lambda";

const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB.DocumentClient();

const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });

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

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (event.requestContext) {
      // get websocket connection information
      const connectionId = event.requestContext.connectionId;
      const routeKey = event.requestContext.routeKey;
      const body = JSON.parse(event.body || "{}");

      let userLocations: Array<any> = new Array();

      // get the rank of the connected user
      let connectedUserId: string = "";
      let connectedRank: number = 0;

      if (event.requestContext.authorizer) {
          connectedUserId = event.requestContext.authorizer.principalId;
      }

      let userQuery = {
        TableName: dbInfo.USER_TABLE_NAME,
        KeyConditionExpression: "UserID = :userid",
        ExpressionAttributeValues: {
            ":userid": connectedUserId
        }
      }

      let dbResult = await dynamo.query(userQuery).promise();

      if (dbResult.Items[0]) {
        // get rank from currently logged-in user
        connectedRank = Number(dbResult.Items[0].rank);
      }

      await Promise.all(body.body.users.map(async (user: any) => {
        let userQuery = {
          TableName: dbInfo.USER_TABLE_NAME,
          KeyConditionExpression: "UserID = :userid",
          ExpressionAttributeValues: {
              ":userid": user
          }
        };

        let dbResult = await dynamo.query(userQuery).promise();

        const locationId: string = dbResult.Items[0]['location'];
        const rank: string = dbResult.Items[0]['rank'];

        let loc: string = "";
        // get meeting name from id
        if (locationId && locationId.length !== 0) {
            // only need to get meeting name if the user has a lower rank than the connected user
            if (Number(rank) <= connectedRank) {
              let meetingQuery = {
                TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME,
                KeyConditionExpression: "MeetingID = :meetingid",
                ExpressionAttributeValues: {
                    ":meetingid": locationId
                }
                };
                dbResult = await dynamo.query(meetingQuery).promise();
                if (dbResult.Items[0] && dbResult.Items[0].topic) {
                  loc = dbResult.Items[0].topic;
                }
            } else {
              loc = "restricted";
            }
        }
        userLocations.push({
            UserId: user,
            location: loc
        });
      }));

      await sendUserMessage(connectionId, { userLocations: userLocations});
    }
    return {
      statusCode: 200,
      body: JSON.stringify({data: 'hello from getUsers'}),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "GET USERS MEETINGS ERROR",
    };
  }
};
