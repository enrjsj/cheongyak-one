package com.cheongyakone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class CheongyakOneApplication {

    public static void main(String[] args) {
        SpringApplication.run(CheongyakOneApplication.class, args);
    }
}
