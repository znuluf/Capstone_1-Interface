FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src
COPY ["src/Capstone.Web.Host/Capstone.Web.Host.csproj", "src/Capstone.Web.Host/"]
COPY ["src/Capstone.Web.Core/Capstone.Web.Core.csproj", "src/Capstone.Web.Core/"]
COPY ["src/Capstone.Application/Capstone.Application.csproj", "src/Capstone.Application/"]
COPY ["src/Capstone.Core/Capstone.Core.csproj", "src/Capstone.Core/"]
COPY ["src/Capstone.EntityFrameworkCore/Capstone.EntityFrameworkCore.csproj", "src/Capstone.EntityFrameworkCore/"]
WORKDIR "/src/src/Capstone.Web.Host"
RUN dotnet restore 

WORKDIR /src
COPY ["src/Capstone.Web.Host", "src/Capstone.Web.Host"]
COPY ["src/Capstone.Web.Core", "src/Capstone.Web.Core"]
COPY ["src/Capstone.Application", "src/Capstone.Application"]
COPY ["src/Capstone.Core", "src/Capstone.Core"]
COPY ["src/Capstone.EntityFrameworkCore", "src/Capstone.EntityFrameworkCore"]
WORKDIR "/src/src/Capstone.Web.Host"
RUN dotnet publish -c Release -o /publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
EXPOSE 80
WORKDIR /app
COPY --from=build /publish .
ENTRYPOINT ["dotnet", "Capstone.Web.Host.dll"]
