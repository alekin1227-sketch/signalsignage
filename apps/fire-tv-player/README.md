# Player Android TV / Fire TV

Aplicativo nativo leve que abre o Player web do Corporate Signage em uma `WebView`, permanece em tela cheia, mantém a tela ligada e tenta iniciar novamente após o boot. O login do dispositivo, a fila, o cache offline e os comandos continuam sendo tratados pelo mesmo Player web e pelo dashboard.

## Configurações no controle remoto

Pressione o botão **Menu (☰)** do controle ou segure **Voltar** para abrir as configurações. É possível trocar sem recompilar o APK:

- **Endereço do Player:** onde a interface da TV está publicada, como `http://10.10.10.6:8081` ou `https://player.empresa.com.br`;
- **Endereço da API:** API e WebSocket, como `http://10.10.10.6:3000/api` ou `https://api.empresa.com.br/api`;
- **Nome/local da TV:** sugestão preenchida automaticamente na primeira ativação.

Em uma rede interna, informe também as portas. Na internet, use domínio e HTTPS em vez de expor diretamente o IP e as portas do Docker.

## Alterar o endereço do servidor

Abra `app/build.gradle` e altere:

```gradle
buildConfigField "String", "PLAYER_URL", '"http://10.10.10.6:8081/?source=fire-tv"'
buildConfigField "String", "API_URL", '"http://10.10.10.6:3000/api"'
```

Use o IP real da máquina onde o Docker está rodando. O Fire TV, o emulador e o servidor precisam estar na mesma rede, e a porta `8081` deve estar liberada no Firewall do Windows.

## Testar no emulador do Android Studio

1. Instale o Android Studio atual no Windows.
2. Em **More Actions > SDK Manager**, instale **Android SDK Platform 35**, **Android SDK Platform-Tools** e **Android Emulator**.
3. Em **More Actions > Virtual Device Manager**, selecione **Create Device > TV > Android TV (1080p)** e uma imagem API 35.
4. Em **File > Open**, abra somente a pasta `apps/fire-tv-player`.
5. Espere a sincronização do Gradle terminar. Na primeira vez o Android Studio baixa as ferramentas necessárias.
6. Inicie a TV virtual e clique em **Run app**.
7. Na tela de ativação, informe o nome da TV e um usuário criado em **Acessos do Player** no dashboard.

Se o servidor estiver no mesmo PC, continue usando o IP real da rede (`10.10.10.6` no exemplo). Só use `10.0.2.2` quando os serviços estiverem restritos a `localhost`.

## Gerar o APK

No Android Studio, use **Build > Build App Bundles or APKs > Build APK(s)**. O arquivo de teste será criado em:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Também é possível gerar pelo PowerShell, dentro da pasta `apps\fire-tv-player`:

```powershell
.\gradlew.bat assembleDebug
```

O inicializador incluído baixa o Gradle 8.9 oficial na primeira execução. O Android SDK ainda precisa ser instalado pelo Android Studio.

## Instalar no Fire TV Stick

Ative **Opções do desenvolvedor > Depuração ADB** no Fire TV. Com o `adb` do Android SDK:

```powershell
adb connect IP-DO-FIRE-TV:5555
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Abra **Corporate Signage** uma vez e faça a ativação. Alimente o Fire TV pela tomada, habilite HDMI-CEC/Anynet+ na Samsung e deixe o aplicativo aberto. O receptor de boot tenta reabrir o Player, mas versões recentes do Fire OS podem bloquear abertura automática em segundo plano; nesse caso ele fica acessível em **Recentes** com um único toque.

O aplicativo 1.2 permite autoplay com áudio no WebView e direciona os botões de volume do controle ao canal de mídia. Os vídeos enviados pelo sistema são normalizados para H.264 + AAC. Se houver imagem sem som, confira primeiro o volume do Fire TV, o volume da TV e se a saída HDMI selecionada aceita áudio.

O emulador Android TV valida instalação, controle remoto, WebView, rede e reprodução. A tela inicial e as restrições de boot da Amazon só podem ser validadas completamente em um Fire TV real ou no serviço virtual da Amazon.

## Reprodução e armazenamento local

Imagens, vídeos e PDFs da fila são baixados para o armazenamento privado do aplicativo usando o cache persistente do WebView/IndexedDB. O Player solicita armazenamento persistente, evita downloads duplicados e mantém a mídia anterior visível enquanto prepara a próxima. Um único vídeo configurado como **Automático + Loop** usa o loop nativo do decodificador e reinicia sem desmontar o vídeo, sem tela preta e sem botão de reprodução.

O primeiro carregamento precisa terminar o download. Depois disso, a mídia permanece disponível mesmo com uma interrupção da rede, respeitando o espaço que o Fire OS disponibilizar ao aplicativo. Não use aplicativos de limpeza que apaguem os dados do Corporate Signage.
