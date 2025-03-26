package com.finalproject.chatter;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ContextConfiguration;
import com.chatter.ChatterApplication;

@SpringBootTest(classes = ChatterApplication.class)
@ContextConfiguration
class ChatterApplicationTests {

    @Test
    void contextLoads() {
    }

}