import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { githubUser, githubRepo, githubBranch, codeStarConnectionArn, awsAccount, awsRegion } from '../private/configuration';
export class CdkWorkshopStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dockerhubSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'pull-creds',
      'arn:aws:secretsmanager:us-east-1:489318732371:secret:dockerhub/image-pull-credentials-pqF5ws');
    console.log(dockerhubSecret.secretArn);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(`${githubUser}/${githubRepo}`, githubBranch, {
          connectionArn: codeStarConnectionArn,
        }),
        commands: ['npm ci','npm run build','npx cdk synth'],
      }),
    
      // Turn this on because the pipeline uses Docker image assets
      dockerEnabledForSelfMutation: true,
      dockerCredentials: [
        pipelines.DockerCredential.dockerHub(dockerhubSecret),
        pipelines.DockerCredential.customRegistry('https://index.docker.io/v1/', dockerhubSecret),
      ],
    });
    
    pipeline.addWave('MyWave', {
      post: [
        new pipelines.CodeBuildStep('RunApproval', {
          commands: ['python3 index.py'],
          buildEnvironment: {
            // The user of a Docker image asset in the pipeline requires turning on
            // 'dockerEnabledForSelfMutation'.
            buildImage: codebuild.LinuxBuildImage.fromAsset(this, 'Image', {
              directory: './demo-image',
            }),
          },
        }),
      ],
    });
  }
}