import axios from "axios";
import { dbInfo} from "./constants";
import type {
    APIGatewayProxyResult,
    APIGatewayProxyHandler,
    APIGatewayProxyEvent,
} from "aws-lambda";
import {v4 as uuidv4} from 'uuid';

const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

const gateway = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });

const createUser = async (userid: string, name: string, zoomId: string, rank: string): Promise<void> => {
     const params = {
        TableName: dbInfo.USER_TABLE_NAME,
        Item: {
            UserID: userid,
            zoomId: zoomId,
            name: name,
            rank: rank
        }
    };
    const results = await dynamo.put(params).promise();
    console.log(results);
}

const sendUserMessage = async (id: any, body: any) => {
    try {
        await gateway.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(body)),
        }).promise();
    } catch (err) {
        console.log(err);
    }
}


const generateError = async (connectionID: any, errmsg: string): Promise<APIGatewayProxyResult> => {
    await sendUserMessage(connectionID, {Error: errmsg});
    return {
        statusCode: 500,
        body: JSON.stringify({
            message: errmsg,
        }),
    };
}

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export const handler: APIGatewayProxyHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId;
    let response: APIGatewayProxyResult;
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
        const newUserID: string = uuidv4();
        await createUser(newUserID, reqbody.name, reqbody.email, reqbody.rank);
        const returnbody = "addedUser";
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    } catch (err) {
        console.log(err);
        return await generateError(connectionId,"Error in add user lambda: " + err);
    }

    return response;
};