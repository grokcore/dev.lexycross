<?php
    $x=explode("\n",file_get_contents("/usr/share/dict/words"));
    foreach ($x as $n) {
        $n=trim($n);
        if (!$n) continue;
        if (strpos($n,"'")!==FALSE) continue;
        $n=strtoupper($n);
        echo $n."\r\n";
    }
