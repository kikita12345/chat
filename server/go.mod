// Этот файл содержит зависимости проекта
// Добавим validator для валидации конфигурации

module messenger

go 1.24

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/go-playground/validator/v10 v10.26.0
	github.com/golang-jwt/jwt/v5 v5.2.2
	github.com/gorilla/websocket v1.5.3
	github.com/redis/go-redis/v9 v9.7.3
	go.uber.org/zap v1.27.0
	golang.org/x/crypto v0.35.0
	gorm.io/driver/postgres v1.5.11
	gorm.io/gorm v1.25.12
)

require (
	github.com/bytedance/sonic v1.13.2
	github.com/cespare/xxhash/v2 v2.2.0
	github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d
	github.com/chenzhuoyu/iasm v0.9.1
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f
	github.com/gabriel-vasile/mimetype v1.4.3
	github.com/gin-contrib/sse v0.1.0
	github.com/go-playground/locales v0.14.1
	github.com/go-playground/universal-translator v0.18.1
	github.com/goccy/go-json v0.10.2
	github.com/jackc/pgpassfile v1.0.0
	github.com/jackc/pgservicefile v0.0.0-20231201235250-de7065d80cb9
	github.com/jackc/pgx/v5 v5.5.1
	github.com/jackc/puddle/v2 v2.2.1
	github.com/jinzhu/inflection v1.0.0
	github.com/jinzhu/now v1.1.5
	github.com/json-iterator/go v1.1.12
	github.com/klauspost/cpuid/v2 v2.2.6
	github.com/leodido/go-urn v1.4.0
	github.com/mattn/go-isatty v0.0.20
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd
	github.com/modern-go/reflect2 v1.0.2
	github.com/pelletier/go-toml/v2 v2.1.1
	github.com/twitchyliquid64/golang-asm v0.15.1
	github.com/ugorji/go/codec v1.2.12
	go.uber.org/multierr v1.11.0
	golang.org/x/arch v0.7.0
	golang.org/x/net v0.21.0
	golang.org/x/sync v0.5.0
	golang.org/x/sys v0.17.0
	golang.org/x/text v0.14.0
	google.golang.org/protobuf v1.32.0
	gopkg.in/yaml.v3 v3.0.1
)