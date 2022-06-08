"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const constants_1 = require("./constants");
const uuid_1 = require("uuid");
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const gateway = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const createUser = async (userid, name, zoomId, rank) => {
    const params = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
        Item: {
            UserID: userid,
            zoomId: zoomId,
            name: name,
            rank: rank
        }
    };
    const results = await dynamo.put(params).promise();
    console.log(results);
};
const sendUserMessage = async (id, body) => {
    try {
        await gateway.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    }
    catch (err) {
        console.log(err);
    }
};
const generateError = async (connectionID, errmsg) => {
    await sendUserMessage(connectionID, { Error: errmsg });
    return {
        statusCode: 500,
        body: JSON.stringify({
            message: errmsg,
        }),
    };
};
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    let response;
    let reqbody;
    if (event.body) {
        reqbody = JSON.parse(event.body);
    }
    const action = reqbody.action;
    let id;
    if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
        id = event.requestContext.authorizer.principalId;
    }
    if (id == null) {
        return await generateError(connectionId, "Id not set");
    }
    try {
        reqbody = reqbody.body;
        const newUserID = (0, uuid_1.v4)();
        await createUser(newUserID, reqbody.name, reqbody.email, reqbody.rank);
        const returnbody = "addedUser";
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    }
    catch (err) {
        console.log(err);
        return await generateError(connectionId, "Error in add user lambda: " + err);
    }
    return response;
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwyQ0FBb0M7QUFNcEMsK0JBQWtDO0FBRWxDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUUvQixNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7QUFFakQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsdUJBQXVCLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFFOUYsTUFBTSxVQUFVLEdBQUcsS0FBSyxFQUFFLE1BQWMsRUFBRSxJQUFZLEVBQUUsTUFBYyxFQUFFLElBQVksRUFBaUIsRUFBRTtJQUNsRyxNQUFNLE1BQU0sR0FBRztRQUNaLFNBQVMsRUFBRSxrQkFBTSxDQUFDLGVBQWU7UUFDakMsSUFBSSxFQUFFO1lBQ0YsTUFBTSxFQUFFLE1BQU07WUFDZCxNQUFNLEVBQUUsTUFBTTtZQUNkLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7U0FDYjtLQUNKLENBQUM7SUFDRixNQUFNLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDbkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN6QixDQUFDLENBQUE7QUFFRCxNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUUsRUFBTyxFQUFFLElBQVMsRUFBRSxFQUFFO0lBQ2pELElBQUk7UUFDQSxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztZQUMzQixjQUFjLEVBQUUsRUFBRTtZQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUNoQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNwQjtBQUNMLENBQUMsQ0FBQTtBQUdELE1BQU0sYUFBYSxHQUFHLEtBQUssRUFBRSxZQUFpQixFQUFFLE1BQWMsRUFBa0MsRUFBRTtJQUM5RixNQUFNLGVBQWUsQ0FBQyxZQUFZLEVBQUUsRUFBQyxLQUFLLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztJQUNyRCxPQUFPO1FBQ0gsVUFBVSxFQUFFLEdBQUc7UUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNqQixPQUFPLEVBQUUsTUFBTTtTQUNsQixDQUFDO0tBQ0wsQ0FBQztBQUNOLENBQUMsQ0FBQTtBQUVEOzs7Ozs7OztHQVFHO0FBQ0ksTUFBTSxPQUFPLEdBQTJCLEtBQUssRUFDaEQsS0FBMkIsRUFDRyxFQUFFO0lBQ2hDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDO0lBQ3ZELElBQUksUUFBK0IsQ0FBQztJQUNwQyxJQUFJLE9BQU8sQ0FBQztJQUNaLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtRQUNaLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNwQztJQUNELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDOUIsSUFBSSxFQUFFLENBQUM7SUFDUCxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtRQUNoRixFQUFFLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDO0tBQ3BEO0lBQ0QsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO1FBQ1osT0FBTyxNQUFNLGFBQWEsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7S0FDMUQ7SUFDRCxJQUFJO1FBQ0EsT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDdkIsTUFBTSxTQUFTLEdBQVcsSUFBQSxTQUFNLEdBQUUsQ0FBQztRQUNuQyxNQUFNLFVBQVUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RSxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUM7UUFDL0IsTUFBTSxlQUFlLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2hELFFBQVEsR0FBRztZQUNQLFVBQVUsRUFBRSxHQUFHO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO1NBQ25DLENBQUM7S0FDTDtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQixPQUFPLE1BQU0sYUFBYSxDQUFDLFlBQVksRUFBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsQ0FBQztLQUMvRTtJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ3BCLENBQUMsQ0FBQztBQWpDVyxRQUFBLE9BQU8sV0FpQ2xCIn0=