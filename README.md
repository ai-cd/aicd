# aicd

这是一个能把任意 github 项目部署到 Sealos 上的工程。

1. 绑定用户的 github 账号，申请获取用户 github 项目权限。
2. 用户创建一个 Project, 输入一个 github 项目地址，或者自己的私有仓库（需要用户给权限）。
3. 通过 AI 分析仓库代码需要的执行环境，比如 node.js golang 等。
4. 在 docker hub 中选择合适的基础镜像，并调用 Sealos 的能力启动项目的运行环境。
5. 在启动的容器中 clone 代码，并安装运行代码所需要的依赖库。
6. 如果项目依赖数据库能力，那么在 Sealos 上启动数据库。
7. 如果项目依赖外网，在 Sealos 启动 ingress。
8. 如果项目还有其它依赖，请以标准的容器方式启动，Sealos 兼容标准的 kubernetes 接口。
9. 最终让项目在 Sealos 上启动起来。

使用 Sealos 的教程可以查看 ./yaml 目录中的描述和用例。
Sealos 的 kubeconfig 已经放到 .secret 目录了。
github 认证信息已经放到 .secret/.env 中了。
调用模型接口的的信息已经放到 .secret/.env 中了。

# UI 要求

简约大方美观，以黑白灰为主色调，线条都用直角

## 开发说明

1. 复制 `.env.example` 到 `.env`，或保持 `.secret/.env`，系统会自动加载。
2. 安装依赖并生成 Prisma Client：
   - `npm install`
   - `npm run prisma:generate`
3. 数据库迁移：
   - `npm run prisma:migrate`
4. 启动：
   - `npm run dev`
