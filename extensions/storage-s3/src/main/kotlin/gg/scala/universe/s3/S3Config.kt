package gg.scala.universe.s3

data class S3Config(
    val bucket: String = "universe-templates",
    val region: String = "us-east-1",
    val endpoint: String? = null,
    val accessKey: String? = null,
    val secretKey: String? = null,
    val prefix: String = "templates/"
)
