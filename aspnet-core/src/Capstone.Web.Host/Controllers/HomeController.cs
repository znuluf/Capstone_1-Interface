using Capstone.Controllers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;

namespace Capstone.Web.Host.Controllers
{
    public class HomeController : CapstoneControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public HomeController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public IActionResult Index()
        {
            // Swagger exists only in Development (DEC-44); elsewhere the API root points to the health check.
            return Redirect(_environment.IsDevelopment() ? "/swagger" : "/health");
        }
    }
}
