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

const getGroups = async (id: string): Promise<Array<string>> => {
    const params = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {
            UserID: id
        },
        AttributesToGet: [
            'groups'
        ]
    };
    const results = await dynamo.get(params).promise();
    if (results.Item.groups) {
        return results.Item.groups;
    }
    return [];
}

const getGroupInfo = async (id: string): Promise<Array<string>> => {
    const params = {
        TableName: dbInfo.GROUPS_TABLE_NAME,
        Key: {
            GroupID: id
        },
        AttributesToGet: [
            'GroupID',
            'members',
            'title',
            'description',
        ]
    };
    const results = await dynamo.get(params).promise();
    if (results.Item) {
        return results.Item;
    }
    return [];
}
const updateGroupInfo = async (toUpdate: string, groupid: string, updateVal: any): Promise<void> => {
    if (toUpdate == "members") {
        let membersWithNames = [];
        const validationParams = {
            TableName: dbInfo.USER_TABLE_NAME,
            Key: {UserID: ''},
            AttributesToGet: [
                'name'
            ]
        };
        for (let member of updateVal) {
            validationParams.Key.UserID = member;
            let results;
            try {
                results = await dynamo.get(validationParams).promise();
                membersWithNames.push({ UserID: member, name: results.Item.name });
            } catch (e) {
                throw "INVALID ID: " + member + ". ID not a valid user. Group Edit Unsuccessful";
            }
        }
        updateVal = membersWithNames;
    }
    const params = {
        TableName: dbInfo.GROUPS_TABLE_NAME,
        Key: {GroupID: groupid},
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: {'#a': toUpdate},
        ExpressionAttributeValues: {
            ':x': updateVal,
        },
        ReturnValues: "UPDATED_NEW",
    };
    const results = await dynamo.update(params).promise();
    console.log(results);
}

const createGroupInfo = async (groupid: string, members: Array<string>, title: string, desc: string): Promise<void> => {
    let membersWithNames = [];
    const validationParams = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {UserID: ''},
        AttributesToGet: [
            'name'
        ]
    };
    for (let member of members) {
        validationParams.Key.UserID = member;
        let results;
        try {
            results = await dynamo.get(validationParams).promise();
            membersWithNames.push({ UserID: member, name: results.Item.name });
        } catch (e) {
            throw "INVALID ID: " + member + ". ID not a valid user. Group Edit Unsuccessful";
        }
    }

    const params = {
        TableName: dbInfo.GROUPS_TABLE_NAME,
        Item: {
            GroupID: groupid,
            title: title,
            members: membersWithNames,
            description: desc
        }
    };
    const results = await dynamo.put(params).promise();
    console.log(results);
}

const createGroup = async (userid: string, groupid: string, members: Array<string>, title: string, desc: string): Promise<string> => {
    await createGroupInfo(groupid, members, title, desc);
    const addToUserGroupsParams = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {UserID: userid},
        UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
        ExpressionAttributeNames: {'#a': 'groups'},
        ExpressionAttributeValues: {
            ':x': [groupid],
            ':empty_list' : []
        },
        ReturnValues: "UPDATED_NEW"
    };
    const results = await dynamo.update(addToUserGroupsParams).promise();
    console.log(results);
    return groupid;
}

const deleteGroup = async (userid: string, group: string): Promise<string> => {
    const usersGroups = await getGroups(userid);
    if (usersGroups.indexOf(group) == -1) {
        throw "This group of ID: " + group + " does not match an existing group to delete";
    }
    const params = {
        TableName: dbInfo.GROUPS_TABLE_NAME,
        Key: {
            GroupID: group,
        },
        ReturnValues: "ALL_OLD"
    };
    await dynamo.delete(params).promise();

    const groups = await getGroups(userid);
    const index = groups.indexOf(group);
    if (index > -1) {
        groups.splice(index, 1); // 2nd parameter means remove one item only
    }

    const deleteGroupFromUserGroupsListParams = {
        TableName: dbInfo.USER_TABLE_NAME,
        Key: {UserID: userid},
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: {'#a': 'groups'},
        ExpressionAttributeValues: {
            ':x': groups,
        },
        ReturnValues: "UPDATED_NEW"
    };
    const results = await dynamo.update(deleteGroupFromUserGroupsListParams).promise();
    console.log(results);
    return "Successfully deleted group";
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
        switch (action) {
            case 'getGroups':
                break;
            case 'createGroup':
                if (reqbody.members == null || reqbody.title == null) {
                    return await generateError(connectionId, "Title or members not specified.")
                }
                const newGroupID: string = uuidv4();
                let desc: string = "N/A";
                if (reqbody.description) {
                    desc = reqbody.description;
                }
                await createGroup(id, newGroupID, reqbody.members, reqbody.title, desc);
                break;
            case 'editGroup':
                if (reqbody.GroupID == null) {
                    return await generateError(connectionId,"group ID not specified.")
                }
                if (reqbody.members) {
                    await updateGroupInfo('members', reqbody.GroupID, reqbody.members);
                }
                if (reqbody.description) {
                    await updateGroupInfo('description', reqbody.GroupID, reqbody.description);
                }
                if (reqbody.title) {
                    await updateGroupInfo('title', reqbody.GroupID, reqbody.title);
                }
                break;
            case 'deleteGroup':
                if (reqbody.GroupID == null) {
                    return await generateError(connectionId, "group ID not specified.")
                }
                await deleteGroup(id, reqbody.GroupID);
                break;
            default:
        }
        let groups = [];
        const groupIDs = await getGroups(id);
        for (let groupID of groupIDs) {
            groups.push(await getGroupInfo(groupID));
        }
        const returnbody = {groups: groups};
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    } catch (err) {
        console.log(err);
        return await generateError(connectionId,"Error in groups lambda: " + err);
    }

    return response;
};