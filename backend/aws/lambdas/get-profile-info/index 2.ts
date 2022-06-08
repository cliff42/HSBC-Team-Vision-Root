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
      let userId: string = "";

      if (event.requestContext.authorizer) {
          userId = event.requestContext.authorizer.principalId;
      }

      if (userId.length > 0) {
        let dbQuery = {
          TableName: dbInfo.USER_TABLE_NAME,
          KeyConditionExpression: "UserID = :userid",
          ExpressionAttributeValues: {
              ":userid": userId
          }
        }
  
        const dbResult = await dynamo.query(dbQuery).promise();
  
        if (dbResult.Items[0]) {
          let profile: any = {};
          const user: any = dbResult.Items[0];

          profile.name = user.name;
          profile.email = user.zoomId;
          profile.imageUrl = user.imageUrl;

          switch(Number(user.rank)) {
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

          await sendUserMessage(connectionId, { profileInfo: profile});
        }
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({data: 'hello from getProfileInfo'}),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "GET PROFILE INFO ERROR",
    };
  }
};
