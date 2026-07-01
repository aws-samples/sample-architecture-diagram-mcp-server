# Examples

Each JSON is the arguments for the `generate_html_diagram` tool. Feed one to the
tool, or describe the architecture and let an agent produce an equivalent file.
The output `.html` is fully self-contained — open it in any browser.

> Icons must be installed first (`./scripts/fetch-icons.sh`). Without them the
> nodes render with category-colored initials.

## serverless-api.json

API Gateway + Lambda + DynamoDB behind CloudFront, single VPC. Shows `role`,
typed connections, `subnet` placement, and an ADR + Well-Architected notes.

## multi-vpc-hybrid.json

On-prem data center connected to **two VPCs** inside a prod **account** — uses
explicit `groups` with nesting (`account → vpc → private-subnet`) and
`external`/`parentId` placement. The topology a fixed hierarchy can't express.

## event-bus-radial.json

EventBridge as a hub with six consumers, using `"direction": "RADIAL"` for a
hub-and-spoke layout.

---

Try the toolbar in any generated diagram: **flow** play/step, **PNG** and
**.drawio** export, the **ADR** panel (when rationale is present), and the
**IaC** handoff.
