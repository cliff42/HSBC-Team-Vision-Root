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
      const body = JSON.parse("{}" || event.body);

      const dbResult = await dynamo.scan({ TableName:dbInfo.USER_TABLE_NAME }).promise();

      let users: Array<any> = new Array();

      dbResult.Items.filter((item: any) => item.UserID != 'testUser').forEach((user: any) => {
        users.push({UserID: user.UserID, name: user.name});
      });

      await sendUserMessage(connectionId, { zoomUsers: users});
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
