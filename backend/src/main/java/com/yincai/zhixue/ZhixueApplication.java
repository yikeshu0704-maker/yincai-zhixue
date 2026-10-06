package com.yincai.zhixue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 因材智学后端启动类。
 * 默认监听 8080 端口（见 application.properties）。
 */
@SpringBootApplication
public class ZhixueApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZhixueApplication.class, args);
    }
}
