"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const constants_1 = require("./constants");
const uuid_1 = require("uuid");
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const gateway = new AWS.ApiGatewayManagementApi({ endpoint: process.env.WEBSOCKET_ENDPOINT });
const getGroups = async (id) => {
    const params = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
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
};
const getGroupInfo = async (id) => {
    const params = {
        TableName: constants_1.dbInfo.GROUPS_TABLE_NAME,
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
};
const updateGroupInfo = async (toUpdate, groupid, updateVal) => {
    if (toUpdate == "members") {
        let membersWithNames = [];
        const validationParams = {
            TableName: constants_1.dbInfo.USER_TABLE_NAME,
            Key: { UserID: '' },
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
            }
            catch (e) {
                throw "INVALID ID: " + member + ". ID not a valid user. Group Edit Unsuccessful";
            }
        }
        updateVal = membersWithNames;
    }
    const params = {
        TableName: constants_1.dbInfo.GROUPS_TABLE_NAME,
        Key: { GroupID: groupid },
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: { '#a': toUpdate },
        ExpressionAttributeValues: {
            ':x': updateVal,
        },
        ReturnValues: "UPDATED_NEW",
    };
    const results = await dynamo.update(params).promise();
    console.log(results);
};
const createGroupInfo = async (groupid, members, title, desc) => {
    let membersWithNames = [];
    const validationParams = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
        Key: { UserID: '' },
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
        }
        catch (e) {
            throw "INVALID ID: " + member + ". ID not a valid user. Group Edit Unsuccessful";
        }
    }
    const params = {
        TableName: constants_1.dbInfo.GROUPS_TABLE_NAME,
        Item: {
            GroupID: groupid,
            title: title,
            members: membersWithNames,
            description: desc
        }
    };
    const results = await dynamo.put(params).promise();
    console.log(results);
};
const createGroup = async (userid, groupid, members, title, desc) => {
    await createGroupInfo(groupid, members, title, desc);
    const addToUserGroupsParams = {
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
        Key: { UserID: userid },
        UpdateExpression: 'set #a = list_append(if_not_exists(#a, :empty_list), :x)',
        ExpressionAttributeNames: { '#a': 'groups' },
        ExpressionAttributeValues: {
            ':x': [groupid],
            ':empty_list': []
        },
        ReturnValues: "UPDATED_NEW"
    };
    const results = await dynamo.update(addToUserGroupsParams).promise();
    console.log(results);
    return groupid;
};
const deleteGroup = async (userid, group) => {
    const usersGroups = await getGroups(userid);
    if (usersGroups.indexOf(group) == -1) {
        throw "This group of ID: " + group + " does not match an existing group to delete";
    }
    const params = {
        TableName: constants_1.dbInfo.GROUPS_TABLE_NAME,
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
        TableName: constants_1.dbInfo.USER_TABLE_NAME,
        Key: { UserID: userid },
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: { '#a': 'groups' },
        ExpressionAttributeValues: {
            ':x': groups,
        },
        ReturnValues: "UPDATED_NEW"
    };
    const results = await dynamo.update(deleteGroupFromUserGroupsListParams).promise();
    console.log(results);
    return "Successfully deleted group";
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
        switch (action) {
            case 'getGroups':
                break;
            case 'createGroup':
                if (reqbody.members == null || reqbody.title == null) {
                    return await generateError(connectionId, "Title or members not specified.");
                }
                const newGroupID = (0, uuid_1.v4)();
                let desc = "N/A";
                if (reqbody.description) {
                    desc = reqbody.description;
                }
                await createGroup(id, newGroupID, reqbody.members, reqbody.title, desc);
                break;
            case 'editGroup':
                if (reqbody.GroupID == null) {
                    return await generateError(connectionId, "group ID not specified.");
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
                    return await generateError(connectionId, "group ID not specified.");
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
        const returnbody = { groups: groups };
        await sendUserMessage(connectionId, returnbody);
        response = {
            statusCode: 200,
            body: JSON.stringify(returnbody)
        };
    }
    catch (err) {
        console.log(err);
        return await generateError(connectionId, "Error in groups lambda: " + err);
    }
    return response;
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwyQ0FBb0M7QUFNcEMsK0JBQWtDO0FBRWxDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUUvQixNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7QUFFakQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsdUJBQXVCLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFFOUYsTUFBTSxTQUFTLEdBQUcsS0FBSyxFQUFFLEVBQVUsRUFBMEIsRUFBRTtJQUMzRCxNQUFNLE1BQU0sR0FBRztRQUNYLFNBQVMsRUFBRSxrQkFBTSxDQUFDLGVBQWU7UUFDakMsR0FBRyxFQUFFO1lBQ0QsTUFBTSxFQUFFLEVBQUU7U0FDYjtRQUNELGVBQWUsRUFBRTtZQUNiLFFBQVE7U0FDWDtLQUNKLENBQUM7SUFDRixNQUFNLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDbkQsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNyQixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0tBQzlCO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNLFlBQVksR0FBRyxLQUFLLEVBQUUsRUFBVSxFQUEwQixFQUFFO0lBQzlELE1BQU0sTUFBTSxHQUFHO1FBQ1gsU0FBUyxFQUFFLGtCQUFNLENBQUMsaUJBQWlCO1FBQ25DLEdBQUcsRUFBRTtZQUNELE9BQU8sRUFBRSxFQUFFO1NBQ2Q7UUFDRCxlQUFlLEVBQUU7WUFDYixTQUFTO1lBQ1QsU0FBUztZQUNULE9BQU87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