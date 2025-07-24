#include <SPI.h>
#include <MFRC522.h>
#include <TFT_eSPI.h>

#define SS_PIN  5
#define RST_PIN 27
MFRC522 mfrc522(SS_PIN, RST_PIN);
TFT_eSPI tft = TFT_eSPI();


void setup() {
    Serial.begin(115200);
    SPI.begin();
    mfrc522.PCD_Init();
    tft.init();
    tft.setRotation(1);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.setTextSize(2);
  }

  void loop() {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      String uid = "";
      for (byte i = 0; i < mfrc522.uid.size; i++) {
        uid += String(mfrc522.uid.uidByte[i], HEX);
      }
  
      // Enviar UID via Serial
      Serial.println(uid);
  
      // Mostrar expressão no display local
      mostrarExpressao(uid);
  
      delay(1000);
      mfrc522.PICC_HaltA();
    }
  }

  void mostrarExpressao(String uid) {
    tft.fillScreen(TFT_BLACK);
    if (uid == "a1b2c3") {
      tft.drawString("Feliz :)", 10, 50);
    } else if (uid == "deadbeef") {
      tft.drawString("Triste :(", 10, 50);
    } else {
      tft.drawString("Desconhecido", 10, 50);
    }
  }
  