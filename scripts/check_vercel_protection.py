"""Read-only gate: refuse deployment unless Vercel authentication covers all URLs."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def main() -> int:
    token = os.environ.get("VERCEL_TOKEN")
    project = os.environ.get("VERCEL_PROJECT_ID")
    team = os.environ.get("VERCEL_ORG_ID")
    if not token or not project:
        print("Deployment blocked: missing Vercel project configuration.")
        return 1
    url = "https://api.vercel.com/v9/projects/" + urllib.parse.quote(project, safe="")
    if team:
        url += "?" + urllib.parse.urlencode({"teamId": team})
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)
    except (urllib.error.URLError, ValueError):
        print("Deployment blocked: could not verify project protection.")
        return 1
    if (data.get("ssoProtection") or {}).get("deploymentType") != "all":
        print("Deployment blocked: enable Vercel Authentication for All Deployments first.")
        return 1
    print("Verified Vercel Authentication: All Deployments.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
