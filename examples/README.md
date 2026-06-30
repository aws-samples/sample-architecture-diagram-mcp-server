# Examples

## serverless-api.json

A minimal API Gateway + Lambda + DynamoDB architecture, with CloudFront serving
a static SPA from S3 and users as an external actor.

Use it as the arguments for the `generate_html_diagram` tool, or generate it
directly from an agent:

> "Generate an interactive diagram for a serverless API: CloudFront in front of
> API Gateway and an S3 static site; API Gateway invokes a Lambda in a private
> subnet; Lambda reads/writes DynamoDB."

The produced `serverless-api.html` is fully self-contained — open it in any
browser. Try the **flow** controls (play/step), **PNG** export, and the **IaC**
handoff button.

> Icons must be installed first (`./scripts/fetch-icons.sh`). Without them the
> nodes render with category-colored initials.
