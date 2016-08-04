import apexjs from 'apex.js';
import util   from 'util';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

const sts       = new AWS.STS();
const xaRoleArn = '<Role ARN>';

export default apexjs(async (event, context) => {
  console.log(util.inspect({event}, {depth: null}));
  console.log(util.inspect({context}, {depth: null}));

  const credentials = (await sts.assumeRole({
    RoleArn:         xaRoleArn,
    RoleSessionName: context.functionName,
  }).promise()).Credentials;

  const s3 = new AWS.S3({
    accessKeyId:     credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken:    credentials.SessionToken,
  });

  const bucketName = event.Records[0].s3.bucket.name;

  console.log(util.inspect({bucketName}, {depth: null}));

  const bucketAcl = await s3.getBucketAcl({
    Bucket: bucketName,
  }).promise();

  console.log(util.inspect({bucketAcl}, {depth: null}));

  const eventObjectAcls = await Promise.all(event.Records.map(record =>
    s3.getObjectAcl({
      Bucket: bucketName,
      Key:    record.s3.object.key,
    }).promise()
  ));

  console.log(util.inspect({eventObjectAcls}, {depth: null}));

  const eventObjectAclConditions = eventObjectAcls.map(acl =>
    acl.Grants.some(grant =>
      grant.Grantee.ID === bucketAcl.Owner.ID
    )
  );

  console.log(util.inspect({eventObjectAclConditions}, {depth: null}));

  const copyObjectResults = await Promise.all(eventObjectAclConditions.map((cond, index) => {
    let ret = null;

    if (!cond) {
      const key = event.Records[index].s3.object.key;

      const copyObjectParams = {
        Bucket:            bucketName,
        Key:               key,
        CopySource:        `${bucketName}/${key}`,
        MetadataDirective: 'REPLACE',
        GrantFullControl:  `id="${bucketAcl.Owner.ID}"`,

        Metadata: {
          dummyTimestamp: Date.now().toString(),
        },
      };

      ret = s3.copyObject(copyObjectParams).promise();
    }

    return ret;
  }));

  console.log(util.inspect({copyObjectResults}, {depth: null}));

  return {copyObjectResults};
});
