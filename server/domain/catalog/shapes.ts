// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Common AWS4 draw.io shape names for the .drawio path (field `shape`), curated
// per AWS official service categories. Every 48px architecture icon is
// represented by its canonical shape key (aliases like `dms`, `iam`, `firehose`
// also resolve — see the core SHAPE_ICONS).
export const DRAWIO_SHAPES: Readonly<Record<string, readonly string[]>> = {
  compute: ["ec2", "lambda", "fargate", "batch", "lightsail", "lightsail_for_research", "elastic_beanstalk", "outposts", "outposts_family", "outposts_servers", "parallel_computing_service", "parallel_cluster", "ec2_auto_scaling", "auto_scaling", "application_auto_scaling", "app_runner", "ec2_image_builder", "elastic_fabric_adapter", "nitro_enclaves", "bottlerocket", "elastic_vmware_service", "elastic_inference", "serverless_application_repository", "simspace_weaver", "nice_enginframe"],
  containers: ["ecs", "eks", "ecr", "red_hat_openshift", "eks_anywhere", "ecs_anywhere", "eks_cloud", "eks_distro"],
  storage: ["s3", "s3_on_outposts", "elastic_block_store", "elastic_file_system", "fsx", "fsx_ontap", "fsx_lustre", "fsx_openzfs", "fsx_for_wfs", "file_cache", "backup", "storage_gateway", "glacier", "backint_agent"],
  database: ["rds", "aurora", "dynamodb", "elasticache", "neptune", "documentdb_with_mongodb_compatibility", "memorydb_for_redis", "keyspaces", "redshift", "timestream", "qldb", "rds_on_vmware", "oracle_database_at_aws"],
  networking: ["cloudfront", "route_53", "vpc", "elastic_load_balancing", "direct_connect", "global_accelerator", "transit_gateway", "vpc_lattice", "api_gateway", "privatelink", "cloud_map", "client_vpn", "site_to_site_vpn", "cloud_wan", "app_mesh", "local_zones", "wavelength", "private_5g", "telco_network_builder"],
  security: ["cognito", "guardduty", "acm", "private_ca", "secrets_manager", "key_management_service", "waf", "shield", "security_hub", "inspector", "macie", "network_firewall", "iam", "iam_identity_center", "cloudhsm", "firewall_manager", "detective", "audit_manager", "directory_service", "verified_access", "verified_permissions", "signer", "security_incident_response", "payment_cryptography", "artifact", "cloud_directory", "security_lake"],
  integration: ["simple_queue_service", "simple_notification_service", "eventbridge", "step_functions", "express_workflows", "mq", "appsync", "simple_email_service", "appflow", "b2b_data_interchange", "appconfig", "appfabric"],
  analytics: ["athena", "kinesis", "kinesis_data_streams", "kinesis_video_streams", "firehose", "glue", "glue_databrew", "glue_elastic_views", "managed_streaming_for_apache_kafka", "managed_flink", "opensearch_service", "emr", "quicksight", "lake_formation", "datazone", "mwaa", "clean_rooms", "data_exchange", "finspace", "cloudsearch", "data_pipeline", "entity_resolution"],
  ai: ["bedrock", "sagemaker", "sagemaker_ai", "sagemaker_ground_truth", "sagemaker_studio_lab", "amazon_q", "nova", "rekognition", "textract", "transcribe", "polly", "translate", "lex", "comprehend", "kendra", "personalize", "forecast", "fraud_detector", "augmented_ai_a2i", "codeguru", "codewhisperer", "devops_guru", "monitron", "lookout_for_equipment", "lookout_for_metrics", "lookout_for_vision", "panorama", "deep_learning_amis", "deep_learning_containers", "deepcomposer", "deeplens", "deepracer", "neuron", "elastic_transcoder"],
  ml_frameworks: ["apache_mxnet_on_aws", "pytorch_on_aws", "tensorflow_on_aws"],
  healthcare: ["healthlake", "healthimaging", "healthomics", "healthscribe", "comprehend_medical"],
  developer_tools: ["codeartifact", "codebuild", "codecommit", "codedeploy", "codepipeline", "codestar", "codecatalyst", "cdk", "cloud9", "cloudshell", "command_line_interface", "x_ray", "corretto", "tools_and_sdks", "application_composer", "infrastructure_composer", "cloud_control_api"],
  migration: ["dms", "datasync", "migration_hub", "application_migration_service", "application_discovery_service", "migration_evaluator", "elastic_disaster_recovery", "transfer_family", "snowball", "snowball_edge", "snowcone", "mainframe_modernization", "data_transfer_terminal", "transform"],
  management: ["cloudwatch_2", "cloudtrail", "config", "systems_manager", "organizations", "cloudformation", "trusted_advisor", "control_tower", "service_catalog", "resource_access_manager", "well_architected_tool", "resilience_hub", "fault_injection_service", "compute_optimizer", "proton", "chatbot", "health_dashboard", "management_console", "console_mobile_application", "launch_wizard", "license_manager", "resource_explorer", "distro_for_opentelemetry", "user_notifications", "service_management_connector", "managed_services", "application_recovery_controller", "opsworks", "prometheus", "grafana"],
  cost: ["cost_explorer", "budgets", "cost_and_usage_report", "billing_conductor", "savings_plans", "reserved_instance_reporting", "application_cost_profiler"],
  iot: ["iot_core", "iot_greengrass", "iot_analytics", "iot_button", "iot_1_click", "iot_device_defender", "iot_device_management", "iot_events", "iot_expresslink", "iot_fleetwise", "iot_sitewise", "iot_twinmaker", "iot_roborunner", "freertos"],
  media: ["elemental_appliances_and_software", "elemental_conductor", "elemental_delta", "elemental_link", "elemental_live", "elemental_mediaconnect", "elemental_mediaconvert", "elemental_medialive", "elemental_mediapackage", "elemental_mediastore", "elemental_mediatailor", "elemental_server", "interactive_video_service", "nimble_studio", "deadline_cloud", "thinkbox_deadline", "thinkbox_frost", "thinkbox_krakatoa", "thinkbox_sequoia", "thinkbox_stoke", "thinkbox_xmesh"],
  business_apps: ["connect", "pinpoint", "pinpoint_apis", "chime", "chime_sdk", "workmail", "workdocs", "workdocs_sdk", "wickr", "supply_chain", "end_user_messaging", "alexa_for_business", "app_studio"],
  end_user_computing: ["workspaces", "workspaces_thin_client", "appstream_2", "nice_dcv", "dcv"],
  front_end: ["amplify", "device_farm", "location_service"],
  game: ["gamelift", "gamelift_servers", "gamelift_streams", "gamesparks", "gamekit", "open_3d_engine"],
  robotics: ["robomaker"],
  satellite: ["ground_station"],
  quantum: ["braket"],
  blockchain: ["managed_blockchain"],
  customer_enablement: ["activate", "iq", "marketplace", "professional_services", "support", "training_certification", "repost", "repost_private"],
};
