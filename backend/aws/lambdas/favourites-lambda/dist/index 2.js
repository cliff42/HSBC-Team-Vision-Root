"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dynamo = new aws_sdk_1.default.DynamoDB.DocumentClient();
const client = new aws_sdk_1.default.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const sendResponse = async (id, data) => {
    try {
        await client.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(data)),
        }).promise();
    }
    catch (err) {
        console.log(err);
    }
};
const getUser = (userUID) => {
    return new Promise((resolve, reject) => {
        dynamo.query({
            TableName: 'UserData',
            KeyConditionExpression: "UserID = :uid",
            ExpressionAttributeValues: {
                ":uid": userUID
            }
        }, function (error, data) {
            var _a;
            if (!error) {
                (_a = data.Items) === null || _a === void 0 ? void 0 : _a.forEach(function (item) {
                    if (item.UserID == userUID) {
                        // return the user
                        resolve(item);
                    }
                });
            }
            reject("No user found with uid: " + userUID);
        });
    });
};
const updateUserFavourites = async (userUID, favourites) => {
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
        }, function (error) {
            if (!error) {
                resolve("Favourites successfully updated");
            }
            reject("Failed to update favourites: " + error);
        });
    });
};
const httpResponse = (status, body) => {
    return { statusCode: status,
        body: JSON.stringify(body)
    };
};
const successResponse = async (connectionId, favourites) => {
    const response = { statusCode: 200, favourites };
    await sendResponse(connectionId, response);
    return httpResponse(200, favourites);
};
const customResponse = async (connectionId, status, body) => {
    const response = httpResponse(status, body);
    await sendResponse(connectionId, response);
    return response;
};
const internalRequestError = async (connectionId, error) => {
    const response = httpResponse(500, 'Favourites Internal Error: ' + error);
    await sendResponse(connectionId, response);
    return response;
};
const invalidRequestError = async (connectionId) => {
    const response = httpResponse(400, 'Users are missing from request or not in database');
    await sendResponse(connectionId, response);
    return response;
};
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    if (!event.body) {
        return await invalidRequestError(connectionId);
    }
    const body = JSON.parse(event.body);
    const action = body.action;
    const authorizer = event.requestContext.authorizer;
    const userID = authorizer ? authorizer.principalId : null;
    if (!userID) {
        console.error("No Authorizer in context");
        return await customResponse(connectionId, 500, "Favourites Error: No Authorizer in context");
    }
    try {
        switch (action) {
            case "updateFavourites":
                const favouritesUIDs = body.favourites;
                let responseStructure = { favourites: [] };
                // validate all the favourites and get their names
                for (const currFavUID of favouritesUIDs) {
                    if (currFavUID == userID) {
                        return await customResponse(connectionId, 400, 'You can not add yourself as a favourite');
                    }
                    await getUser(currFavUID).then((user) => {
                        responseStructure.favourites.push({
                            UserID: currFavUID,
                            name: user.name
                        });
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
                return await getUser(userID).then(async (user) => {
                    const favourites = user.favourites;
                    let responseStructure = { favourites: [] };
                    if (!favourites) {
                        return await successResponse(connectionId, responseStructure.favourites);
                    }
                    for (const currFavUID of favourites) {
                        await getUser(currFavUID).then((user) => {
                            responseStructure.favourites.push({
                                UserID: currFavUID,
                                name: user.name
                            });
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
    }
    catch (error) {
        console.error(error);
        return await internalRequestError(connectionId, error);
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFLQSxzREFBMEI7QUFFMUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGlCQUFHLENBQUMsdUJBQXVCLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFFN0YsTUFBTSxZQUFZLEdBQUcsS0FBSyxFQUFFLEVBQU8sRUFBRSxJQUFTLEVBQUUsRUFBRTtJQUNoRCxJQUFJO1FBQ0EsTUFBTSxNQUFNLENBQUMsZ0JBQWdCLENBQUM7WUFDMUIsY0FBYyxFQUFFLEVBQUU7WUFDbEIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1QyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDaEI7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDcEI7QUFDSCxDQUFDLENBQUE7QUFFRCxNQUFNLE9BQU8sR0FBRyxDQUFDLE9BQWUsRUFBZ0IsRUFBRTtJQUNoRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3JDLE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFDVCxTQUFTLEVBQUUsVUFBVTtZQUNyQixzQkFBc0IsRUFBRyxlQUFlO1lBQ3hDLHlCQUF5QixFQUFFO2dCQUN6QixNQUFNLEVBQUUsT0FBTzthQUNoQjtTQUNKLEVBQUUsVUFBUyxLQUFLLEVBQUUsSUFBSTs7WUFDckIsSUFBRyxDQUFDLEtBQUssRUFBRTtnQkFDVCxNQUFBLElBQUksQ0FBQyxLQUFLLDBDQUFFLE9BQU8sQ0FB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