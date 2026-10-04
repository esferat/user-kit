package com.acme.usermark;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class UserKitApplication {

    public static void main(String[] args) {
        SpringApplication.run(UserKitApplication.class, args);
    }
}
