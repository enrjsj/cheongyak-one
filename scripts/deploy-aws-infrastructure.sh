#!/usr/bin/env bash
set -euo pipefail

# 프로젝트 루트 기준으로 실행해 호출 위치에 따른 템플릿 경로 오류를 막는다.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
STACK_PREFIX="${STACK_PREFIX:-cheongyak-one}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-production}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-enrjsj/cheongyak-one}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"
REB_API_SECRET_ARN="${REB_API_SECRET_ARN:-}"
DATABASE_DELETION_PROTECTION="${DATABASE_DELETION_PROTECTION:-true}"
BACKEND_STACK="${STACK_PREFIX}-backend"
EDGE_STACK="${STACK_PREFIX}-edge"

for command_name in aws; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

if [[ -n "${REB_API_SECRET_ARN}" ]]; then
  secret_region="$(printf '%s' "${REB_API_SECRET_ARN}" | cut -d: -f4)"
  if [[ "${secret_region}" != "${AWS_REGION}" ]]; then
    echo "REB_API_SECRET_ARN must be in ${AWS_REGION}." >&2
    exit 1
  fi
  aws secretsmanager describe-secret \
    --region "${AWS_REGION}" \
    --secret-id "${REB_API_SECRET_ARN}" >/dev/null
fi

# 최신 Corretto 21 스택 이름은 리전마다 달라 AWS에서 조회해 전달한다.
solution_stack_name="$(aws elasticbeanstalk list-available-solution-stacks \
  --region "${AWS_REGION}" \
  --query "SolutionStacks[?contains(@, 'Amazon Linux 2023') && contains(@, 'Corretto 21')]|[0]" \
  --output text)"
if [[ -z "${solution_stack_name}" || "${solution_stack_name}" == "None" ]]; then
  echo "No Corretto 21 Amazon Linux 2023 Elastic Beanstalk platform was found." >&2
  exit 1
fi

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${BACKEND_STACK}" \
  --template-file "${PROJECT_ROOT}/infra/aws/backend-platform.yml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    "ProjectName=${STACK_PREFIX}" \
    "EnvironmentName=${ENVIRONMENT_NAME}" \
    "BeanstalkSolutionStackName=${solution_stack_name}" \
    "DatabaseDeletionProtection=${DATABASE_DELETION_PROTECTION}" \
    "RebApiSecretArn=${REB_API_SECRET_ARN}"

stack_output() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "${AWS_REGION}" \
    --stack-name "${stack_name}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

application_origin="$(stack_output "${BACKEND_STACK}" ApplicationOriginDomainName)"
deployment_bucket="$(stack_output "${BACKEND_STACK}" DeploymentBucketName)"
beanstalk_application="$(stack_output "${BACKEND_STACK}" ApplicationName)"
beanstalk_environment="$(stack_output "${BACKEND_STACK}" EnvironmentName)"
account_id="$(aws sts get-caller-identity --query Account --output text)"
oidc_provider_arn="arn:aws:iam::${account_id}:oidc-provider/token.actions.githubusercontent.com"
if ! aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "${oidc_provider_arn}" >/dev/null 2>&1; then
  oidc_provider_arn=""
fi

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${EDGE_STACK}" \
  --template-file "${PROJECT_ROOT}/infra/aws/application-edge.yml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    "ProjectName=${STACK_PREFIX}" \
    "EnvironmentName=${ENVIRONMENT_NAME}" \
    "ApplicationOriginDomainName=${application_origin}" \
    "DeploymentBucketName=${deployment_bucket}" \
    "BeanstalkApplicationName=${beanstalk_application}" \
    "BeanstalkEnvironmentName=${beanstalk_environment}" \
    "GitHubRepository=${GITHUB_REPOSITORY}" \
    "GitHubEnvironment=${GITHUB_ENVIRONMENT}" \
    "GitHubOidcProviderArn=${oidc_provider_arn}"

if [[ -n "${ALERT_EMAIL:-}" ]]; then
  aws cloudformation deploy \
    --region "${AWS_REGION}" \
    --stack-name "${STACK_PREFIX}-budget" \
    --template-file "${PROJECT_ROOT}/infra/aws/budget-alert.yml" \
    --parameter-overrides \
      "AlertEmail=${ALERT_EMAIL}" \
      "MonthlyBudgetUsd=${MONTHLY_BUDGET_USD:-20}"
fi

echo "AWS infrastructure deployment completed."
echo "Site URL: $(stack_output "${EDGE_STACK}" SiteUrl)"
echo "Run scripts/configure-github-aws.sh after GitHub CLI authentication."
