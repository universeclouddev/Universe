package gg.scala.universe.util.json.adapter

import com.google.gson.ExclusionStrategy
import com.google.gson.FieldAttributes
import gg.scala.universe.util.json.Exclude

class ExclusionStrategyAdapter : ExclusionStrategy {
    override fun shouldSkipField(field: FieldAttributes): Boolean {
        return field.getAnnotation(Exclude::class.java) != null
    }

    override fun shouldSkipClass(clazz: Class<*>): Boolean {
        return clazz.getAnnotation(Exclude::class.java) != null
    }
}
