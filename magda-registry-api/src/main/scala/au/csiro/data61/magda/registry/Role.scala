package au.csiro.data61.magda.registry

sealed trait Role
case object Full extends Role
case object ReadOnly extends Role
