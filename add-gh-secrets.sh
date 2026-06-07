#!/bin/bash

REPO="githubusername/reponame"  # 🔁 Replace with your target repo
ENV_FILE=".env.prod"

while IFS='=' read -r key value
do
  if [[ ! $key =~ ^# && $key ]]; then
    echo "🔐 Uploading $key..."
    gh secret set "$key" --repo "$REPO" --body "$value"
  fi
done < "$ENV_FILE"

echo "✅ All secrets uploaded to $REPO"
