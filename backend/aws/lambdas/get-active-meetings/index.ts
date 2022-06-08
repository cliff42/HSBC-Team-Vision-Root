import axios from "axios";
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

      let mainId: string = 'me';
      let path: string = '/v2/users/' + mainId + '/meetings'
                
      
                
      let userId: string = "";
      let userRank: number = 0;

      if (event.requestContext.authorizer) {
          userId = event.requestContext.authorizer.principalId;
      }

      let userQuery = {
        TableName: dbInfo.USER_TABLE_NAME,
        KeyConditionExpression: "UserID = :userid",
        ExpressionAttributeValues: {
            ":userid": userId
        }
      }

      let dbResult = await dynamo.query(userQuery).promise();

      if (dbResult.Items[0]) {
        // get rank from currently logged-in user
        userRank = Number(dbResult.Items[0].rank);
      }
      
      dbResult = await dynamo.scan({ TableName: dbInfo.ACTIVE_MEETINGS_TABLE_NAME }).promise();

      let formattedMeetings: any = {zoomMeetings: {meetings: []}};

      if(dbResult.Items != null && dbResult.Items != []) {
        dbResult.Items.forEach((meeting: any) => {
            let invitedList: Array<string> = new Array();
            invitedList = meeting.invitedUsers; 
            // only show meetings that the user has authority to see
            if (invitedList?.includes(userId)|| Number(meeting.hostRank) <= userRank) {
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
      body: JSON.stringify({data: 'hello from getActiveMeetings'}),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "GET ACTIVE MEETINGS ERROR",
    };
  }
};
