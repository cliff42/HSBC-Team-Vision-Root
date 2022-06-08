"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const admin = require("firebase-admin");
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS ? process.env.FIREBASE_CREDENTIALS : ""))
});
const generatePolicy = function (effect, resource) {
    var policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": effect,
                "Action": "execute-api:Invoke",
                "Resource": resource
            }
        ]
    };
    return policy;
};
// NOTE: This authentication handler accepts tokens sent as a Query Parameter of the URI
// THIS IS NOT A SECURE WAY OF SENDING TOKENS
// https://websockets.readthedocs.io/en/latest/topics/authentication.html#query-parameter
/*
    "URIs end up in logs, which leaks credentials. Even if that risk could be lowered with single-use tokens,
        it is usually considered unacceptable."
*/
const handler = (event, context, callback) => {
    const auth = admin.auth();
    let token = "";
    if (event.queryStringParameters) {
        token = event.queryStringParameters.token;
        if (!token) {
            callback("Unauthorized");
        }
    }
    if (token == "testToken") {
        const policy = generatePolicy("Allow", event.methodArn);
        const response = {
            principalId: "testUser",
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    }
    auth.verifyIdToken(token).then((decodedToken) => {
        const uid = decodedToken.uid;
        const policy = generatePolicy("Allow", event.methodArn);
        const response = {
            principalId: uid,
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    }).catch((error) => {
        const policy = generatePolicy("Deny", event.methodArn);
        const response = {
            principalId: "user",
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    });
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFRQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUV4QyxLQUFLLENBQUMsYUFBYSxDQUFDO0lBQ2xCLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQ3hILENBQUMsQ0FBQztBQUVILE1BQU0sY0FBYyxHQUFHLFVBQVMsTUFBYyxFQUFFLFFBQWdCO0lBQzVELElBQUksTUFBTSxHQUFHO1FBQ1QsU0FBUyxFQUFFLFlBQVk7UUFDdkIsV0FBVyxFQUFFO1lBQ1Q7Z0JBQ0ksUUFBUSxFQUFFLE1BQU07Z0JBQ2hCLFFBQVEsRUFBRSxvQkFBb0I7Z0JBQzlCLFVBQVUsRUFBRSxRQUFRO2FBQ3ZCO1NBQ0o7S0FDSixDQUFDO0lBRUYsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQyxDQUFBO0FBRUQsd0ZBQXdGO0FBQ3hGLDZDQUE2QztBQUM3Qyx5RkFBeUY7QUFDekY7OztFQUdFO0FBQ0ssTUFBTSxPQUFPLEdBQXVDLENBQ3pELEtBQXVDLEVBQUUsT0FBZ0IsRUFDekQsUUFBc0MsRUFBOEMsRUFBRTtJQUVwRixNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFMUIsSUFBSSxLQUFLLEdBQXVCLEVBQUUsQ0FBQztJQUNuQyxJQUFHLEtBQUssQ0FBQyxxQkFBcUIsRUFBRTtRQUM5QixLQUFLLEdBQUcsS0FBSyxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQztRQUMxQyxJQUFHLENBQUMsS0FBSyxFQUFFO1lBQ1QsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQzFCO0tBQ0Y7SUFFRCxJQUFHLEtBQUssSUFBSSxXQUFXLEVBQUU7UUFDckIsTUFBTSxNQUFNLEdBQUcsY0FBYyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEQsTUFBTSxRQUFRLEdBQStCO1lBQ3pDLFdBQVcsRUFBRSxVQUFVO1lBQ3ZCLGNBQWMsRUFBRSxNQUFNO1lBQ3RCLE9BQU8sRUFBRSxFQUFFO1NBQ2QsQ0FBQztRQUNGLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7S0FDNUI7SUFFRCxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQWlCLEVBQUUsRUFBRTtRQUNqRCxNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDO1FBQzdCLE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXhELE1BQU0sUUFBUSxHQUFHO1lBQ2IsV0FBVyxFQUFFLEdBQUc7WUFDaEIsY0FBYyxFQUFFLE1BQU07WUFDdEIsT0FBTyxFQUFFLEVBQUU7U0FDZCxDQUFDO1FBQ0YsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFVLEVBQUUsRUFBRTtRQUNwQixNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV2RCxNQUFNLFFBQVEsR0FBRztZQUNiLFdBQVcsRUFBRSxNQUFNO1lBQ25CLGNBQWMsRUFBRSxNQUFNO1lBQ3RCLE9BQU8sRUFBRSxFQUFFO1NBQ2QsQ0FBQztRQUNGLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDN0IsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUM7QUE1Q1csUUFBQSxPQUFPLFdBNENsQiJ9