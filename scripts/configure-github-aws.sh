#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
STACK_PREFIX="${STACK_PREFIX:-cheongyak-one}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-enrjsj/cheongyak-one}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"
BACKEND_STACK="${STACK_PREFIX}-backend"
EDGE_STACK="${STACK_PREFIX}-edge"

for command_name in aws gh; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

# 인증 상태를 먼저 확인해 일부 변수만 저장되는 중간 실패를 피한다.
gh auth status >/dev/null
aws sts get-caller-identity >/dev/null

stack_output() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "${AWS_REGION}" \
    --stack-name "${stack_name}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

gh variable set AWS_REGION --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "${AWS_REGION}"
gh variable set AWS_ROLE_ARN --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${EDGE_STACK}" GitHubDeploymentRoleArn)"
gh variable set EB_APPLICATION --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${BACKEND_STACK}" ApplicationName)"
gh variable set EB_ENVIRONMENT --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${BACKEND_STACK}" EnvironmentName)"
gh variable set EB_DEPLOYMENT_BUCKET --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${BACKEND_STACK}" DeploymentBucketName)"
gh variable set FRONTEND_BUCKET --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${EDGE_STACK}" FrontendBucketName)"
gh variable set CLOUDFRONT_DISTRIBUTION_ID --repo "${GITHUB_REPOSITORY}" --env "${GITHUB_ENVIRONMENT}" --body "$(stack_output "${EDGE_STACK}" CloudFrontDistributionId)"

echo "GitHub environment variables configured for ${GITHUB_REPOSITORY}:${GITHUB_ENVIRONMENT}."
