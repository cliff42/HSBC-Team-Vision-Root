import type {
  APIGatewayRequestAuthorizerHandler,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerCallback,
  APIGatewayAuthorizerResult,
  Context
} from "aws-lambda";

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS ? process.env.FIREBASE_CREDENTIALS : ""))
});

const generatePolicy = function(effect: string, resource: string) {
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
}

// NOTE: This authentication handler accepts tokens sent as a Query Parameter of the URI
// THIS IS NOT A SECURE WAY OF SENDING TOKENS
// https://websockets.readthedocs.io/en/latest/topics/authentication.html#query-parameter
/*
    "URIs end up in logs, which leaks credentials. Even if that risk could be lowered with single-use tokens, 
        it is usually considered unacceptable."
*/
export const handler: APIGatewayRequestAuthorizerHandler = (
  event: APIGatewayRequestAuthorizerEvent, context: Context, 
  callback: APIGatewayAuthorizerCallback): void | Promise<APIGatewayAuthorizerResult> => {
  
    const auth = admin.auth();

    let token: string | undefined = "";
    if(event.queryStringParameters) {
      token = event.queryStringParameters.token;
      if(!token) {
        callback("Unauthorized");
      }
    }
    
    if(token == "testToken") {
        const policy = generatePolicy("Allow", event.methodArn);
        const response: APIGatewayAuthorizerResult = {
            principalId: "testUser",
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    }

    auth.verifyIdToken(token).then((decodedToken: any) => {
        const uid = decodedToken.uid;
        const policy = generatePolicy("Allow", event.methodArn);
    
        const response = {
            principalId: uid,
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    }).catch((error: any) => {
        const policy = generatePolicy("Deny", event.methodArn);
        
        const response = {
            principalId: "user",
            policyDocument: policy,
            context: {}
        };
        callback(null, response);
    });
};
