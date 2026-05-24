terraform {
  cloud {
    organization = "UITFood"

    workspaces {
      name = "uitfood-render-production"
    }
  }

  required_version = "~> 1.15.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
}
