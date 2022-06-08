import type {
  APIGatewayProxyResult,
  APIGatewayProxyHandler,
  APIGatewayProxyEvent
} from "aws-lambda";
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();

const client = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });

const sendResponse = async (id: any, data: any) => {
  try {
      await client.postToConnection({
          'ConnectionId': id,
          'Data': Buffer.from(JSON.stringify(data)),
      }).promise();
  } catch (err) {
      console.log(err);
  }
}

const getUser = (userUID: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    dynamo.query({
        TableName: 'UserData',
        KeyConditionExpression : "UserID = :uid",
        ExpressionAttributeValues: {
          ":uid": userUID
        }
    }, function(error, data) {
      if(!error) {
        data.Items?.forEach(function(item) {
          if(item.UserID == userUID) {
            // return the user
            resolve(item);
          }
        });
      }
      reject("No user found with uid: " + userUID);
    });
  });
}

const updateUserFavourites = async (userUID: string, favourites: []) => {
  return new Promise((resolve, reject) => {
    dynamo.update({
        TableName: 'UserData',
        Key: {
          UserID: userUID
        },
        UpdateExpression: "set favourites = :f",
        ExpressionAttributeValues: {
          ":f": favourites
        }
    }, function(error) {
      if(!error) {
        resolve("Favourites successfully updated");
      }
      reject("Failed to update favourites: " + error);
    });
  });
}

const httpResponse = (status: number, body: any) => {
  return { statusCode: status,
            body: JSON.stringify(body)
            };
}

const successResponse = async (connectionId: any, favourites: any) => {
  const response = { statusCode: 200, favourites }
  await sendResponse(connectionId, response);
  return httpResponse(200, favourites);
}

const customResponse = async (connectionId: any, status: number, body: string) => {
  const response = httpResponse(status, body);
  await sendResponse(connectionId, response);
  return response;
}

const internalRequestError = async (connectionId: any, error: any) => {
  const response = httpResponse(500, 'Favourites Internal Error: ' + error);
  await sendResponse(connectionId, response);
  return response;
}

const invalidRequestError = async (connectionId: any) => {
  const response = httpResponse(400, 'Users are missing from request or not in database');
  await sendResponse(connectionId, response);
  return response;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  if(!event.body) {
    return await invalidRequestError(connectionId);
  }
  const body = JSON.parse(event.body);
  const action = body.action;

  const authorizer = event.requestContext.authorizer;
  const userID = authorizer ? authorizer.principalId : null;
  if(!userID) {
    console.error("No Authorizer in context");
    return await customResponse(connectionId, 500, "Favourites Error: No Authorizer in context");
  }
  try {
  switch(action) {
    case "updateFavourites": 
        const favouritesUIDs: [] = body.favourites;
        let responseStructure: {favourites: {UserID: string, name: string}[]} = { favourites: [] };

        // validate all the favourites and get their names
        for(const currFavUID of favouritesUIDs) {
          if(currFavUID == userID) {
            return await customResponse(connectionId, 400, 'You can not add yourself as a favourite');
          }

          await getUser(currFavUID).then((user: any) => {
            responseStructure.favourites.push({
              UserID: currFavUID,
              name: user.name});
          }).catch(async (error) => {
              return await internalRequestError(connectionId, error);
          });
        }
        return await updateUserFavourites(userID, favouritesUIDs).then(async () => {
              return await successResponse(connectionId, responseStructure.favourites);
          }).catch(async (error) => {
              return await internalRequestError(connectionId, error);
          });
      case "getFavourites":
        return await getUser(userID).then(async (user: any) => {
            const favourites = user.favourites;
            let responseStructure: {favourites: {UserID: string, name: string}[]} = { favourites: [] };
            if(!favourites) {
              return await successResponse(connectionId, responseStructure.favourites);
            }
            for(const currFavUID of favourites) {
              await getUser(currFavUID).then((user) => {
                responseStructure.favourites.push({
                  UserID: currFavUID,
                  name: user.name});
              }).catch(async (error) => {
                  return await internalRequestError(connectionId, error);
              });
            }
            return await successResponse(connectionId, responseStructure.favourites);
          }).catch(async (error) => {
              return await internalRequestError(connectionId, error);
          });
      default:
        return await invalidRequestError(connectionId);
    }
  } catch (error) {
      console.error(error);
      return await internalRequestError(connectionId, error);
  }
};
