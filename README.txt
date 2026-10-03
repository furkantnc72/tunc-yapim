101 OKEY ARENA - PROFIL + ANDROID V4

YENI PROFIL SISTEMI
- Ana ekranda Profil / Profili Duzenle bolumu.
- Kullanici adi degistirilebilir.
- 12 hazir oyun avatari secilebilir.
- Galeriden fotograf secilebilir.
- Galeriden gelen fotograf kare kirpilip 256x256 JPEG olarak kucultulur.
- Profil cihazda localStorage ile saklanir.
- Odaya girince isim + avatar/fotograf diger oyunculara aktarilir.
- Masa oyuncu kartlarinda profil resmi gorunur.

ANDROID
- @capacitor/android eklendi.
- ANDROID_HAZIRLA.bat: paketleri kurar, web build alir ve Android projesini olusturur.
- Gercek telefonda yerel test icin Profil ekranindaki Android test sunucusu alanina bilgisayar IP'si yazilabilir (ornek http://192.168.1.10:3001).
- Play Store icin localhost kullanilamaz; sonraki asamada Node/Socket.IO sunucusunu internete yayinlamak gerekir.

ONCEKI DUZELTMELER KORUNDU
- Bosluklu istaka / per gruplari
- Per toplu acma
- 5 cift acarken sadece ciftlerin cikmasi
- Yandan alinan tasla acma zorunlulugu
- Yandan tas cezasinin tasi atan oyuncuya yazilmasi
- Okeyin 5 saniye basili tutunca sadece kendi ekraninda donmesi

Windows oyun testi: OYUNU BASLAT.bat
Android proje hazirlama: ANDROID_HAZIRLA.bat
