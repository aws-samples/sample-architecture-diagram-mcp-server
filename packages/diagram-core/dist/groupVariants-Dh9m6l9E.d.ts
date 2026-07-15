declare function resolveVariant(v: any): any;
declare function variantKey(v: any): any;
declare const GROUP_VARIANTS: {
    "aws-cloud": {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    region: {
        stroke: string;
        icon: string;
        grIcon: string;
        dashed: boolean;
    };
    vpc: {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "public-subnet": {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "private-subnet": {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "availability-zone": {
        stroke: string;
        icon: string;
        grIcon: string;
        dashed: boolean;
    };
    account: {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    organization: {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "auto-scaling-group": {
        stroke: string;
        icon: string;
        grIcon: string;
        dashed: boolean;
    };
    group: {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "corporate-data-center": {
        stroke: string;
        icon: string;
        grIcon: string;
    };
    "on-premises": {
        stroke: string;
        icon: string;
        grIcon: string;
        dashed: boolean;
    };
};
declare const DEFAULT_VARIANT: "group";
declare const VARIANT_ALIASES: {
    "pub-sub": string;
    "priv-sub": string;
    az: string;
    asg: string;
    datacenter: string;
    "on-prem": string;
};
declare const ALL_GROUP_ICONS: string[];

export { ALL_GROUP_ICONS as A, DEFAULT_VARIANT as D, GROUP_VARIANTS as G, VARIANT_ALIASES as V, resolveVariant as r, variantKey as v };
