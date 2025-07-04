<?php
if (!function_exists('toCamelCaseArray')) {
    function toCamelCaseArray($array) {
        $result = [];
        foreach ($array as $key => $value) {
            $camelKey = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $key))));
            $result[$camelKey] = $value;
        }
        return $result;
    }
} 