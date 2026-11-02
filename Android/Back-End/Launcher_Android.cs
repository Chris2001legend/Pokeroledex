using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace PokeroledexLauncherAndroid
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "PokéroleDex 3.0 - Server Android / Smartphone";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("=================================================================");
            Console.WriteLine("        POKEROLEDEX 3.0 - EDIZIONE SMARTPHONE & ANDROID          ");
            Console.WriteLine("=================================================================");
            Console.ResetColor();
            Console.WriteLine();

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            Directory.SetCurrentDirectory(appDir);

            string pythonExe = FindPython();

            if (string.IsNullOrEmpty(pythonExe))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] Python non è stato trovato sul tuo computer.");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Vuoi provare ad installarlo automaticamente con Windows Package Manager (winget)?");
                Console.Write("Installa Python adesso? [S/N]: ");

                string answer = Console.ReadLine();
                if (!string.IsNullOrEmpty(answer) && answer.Trim().ToLower().StartsWith("s"))
                {
                    Console.WriteLine("\nAvvio installazione automatica di Python 3.12 via winget... Attendi...");
                    try
                    {
                        Process winget = Process.Start(new ProcessStartInfo
                        {
                            FileName = "winget",
                            Arguments = "install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements",
                            UseShellExecute = false
                        });
                        winget.WaitForExit();
                        pythonExe = FindPython();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("Errore winget: " + ex.Message);
                    }
                }

                if (string.IsNullOrEmpty(pythonExe))
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("\n[ATTENZIONE] Per eseguire PokéroleDex è necessario avere Python.");
                    Console.WriteLine("Scaricalo gratuitamente da: https://www.python.org/downloads/");
                    Console.WriteLine("Ricordati di spuntare la casella 'Add Python to PATH' durante l'installazione!\n");
                    Console.ResetColor();
                    Console.WriteLine("Premi un tasto per uscire...");
                    Console.ReadKey();
                    return;
                }
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[*] Interprete Python rilevato: " + pythonExe);
            Console.ResetColor();

            // Auto-install requirements if requirements.txt exists
            string reqFile = Path.Combine(appDir, "requirements.txt");
            if (File.Exists(reqFile))
            {
                Console.WriteLine("[*] Controllo ed installazione dipendenze (Flask)...");
                try
                {
                    ProcessStartInfo pipPsi = new ProcessStartInfo
                    {
                        FileName = pythonExe,
                        Arguments = "-m pip install -r requirements.txt --quiet --no-warn-script-location",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    Process pip = Process.Start(pipPsi);
                    pip.WaitForExit();
                }
                catch { }
            }

            string scriptPath = Path.Combine(appDir, "Back-End", "app.py");
            if (!File.Exists(scriptPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Errore: Impossibile trovare il file server in " + scriptPath);
                Console.ResetColor();
                Console.ReadKey();
                return;
            }

            string lanIp = GetLanIP();
            string phoneUrl = "http://" + lanIp + ":5000/";

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine();
            Console.WriteLine("=================================================================");
            Console.WriteLine(" [OK] SERVER ATTIVO E PRONTO PER IL TUO TELEFONO ANDROID!        ");
            Console.WriteLine("=================================================================");
            Console.ResetColor();
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("📱 COME AVVIARE L'APP SUL TUO TELEFONO ANDROID:");
            Console.WriteLine("-----------------------------------------------------------------");
            Console.ResetColor();
            Console.WriteLine(" 1. Assicurati che il telefono sia connesso allo STESSO Wi-Fi");
            Console.WriteLine("    (oppure all'Hotspot del computer).");
            Console.WriteLine();
            Console.WriteLine(" 2. Apri Google Chrome sul tuo telefono e vai a questo indirizzo:");
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("    👉  " + phoneUrl);
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine(" 3. INSTALLA COME VERA APP:");
            Console.WriteLine("    Su Chrome del telefono tocca i 3 puntini in alto a destra ⋮");
            Console.WriteLine("    e seleziona 'Aggiungi a schermata Home' / 'Installa app'.");
            Console.WriteLine("    L'app si aprirà a schermo intero come una normale app Android!");
            Console.WriteLine("-----------------------------------------------------------------");
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.WriteLine("[*] Apertura automatica nel browser del PC: http://127.0.0.1:5000/");
            Console.ResetColor();
            Console.WriteLine("[*] Premi CTRL+C in questa finestra per arrestare il server.");
            Console.WriteLine();

            ProcessStartInfo appPsi = new ProcessStartInfo
            {
                FileName = pythonExe,
                Arguments = "\"" + scriptPath + "\"",
                UseShellExecute = false,
                WorkingDirectory = appDir
            };
            appPsi.EnvironmentVariables["BIND_HOST"] = "0.0.0.0";
            appPsi.EnvironmentVariables["PORT"] = "5000";

            try
            {
                Process serverProc = Process.Start(appPsi);
                serverProc.WaitForExit();
            }
            catch (Exception ex)
            {
                Console.WriteLine("Errore nell'avvio del server: " + ex.Message);
                Console.ReadKey();
            }
        }

        static string GetLanIP()
        {
            try
            {
                using (Socket socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
                {
                    socket.Connect("8.8.8.8", 65530);
                    IPEndPoint endPoint = socket.LocalEndPoint as IPEndPoint;
                    if (endPoint != null)
                    {
                        return endPoint.Address.ToString();
                    }
                }
            }
            catch { }

            try
            {
                string host = Dns.GetHostName();
                IPHostEntry entry = Dns.GetHostEntry(host);
                foreach (IPAddress ip in entry.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    {
                        return ip.ToString();
                    }
                }
            }
            catch { }

            return "127.0.0.1";
        }

        static string FindPython()
        {
            if (TryRunCommand("python", "--version")) return "python";
            if (TryRunCommand("py", "--version")) return "py";

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string pyPrograms = Path.Combine(localAppData, "Programs", "Python");
            if (Directory.Exists(pyPrograms))
            {
                string[] dirs = Directory.GetDirectories(pyPrograms, "Python*");
                Array.Sort(dirs);
                Array.Reverse(dirs);
                foreach (string d in dirs)
                {
                    string candidate = Path.Combine(d, "python.exe");
                    if (File.Exists(candidate)) return candidate;
                }
            }

            string[] rootDirs = Directory.GetDirectories(@"C:\", "Python*");
            foreach (string d in rootDirs)
            {
                string candidate = Path.Combine(d, "python.exe");
                if (File.Exists(candidate)) return candidate;
            }

            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            try
            {
                string[] pfDirs = Directory.GetDirectories(pf, "Python*");
                foreach (string d in pfDirs)
                {
                    string candidate = Path.Combine(d, "python.exe");
                    if (File.Exists(candidate)) return candidate;
                }
            }
            catch { }

            return null;
        }

        static bool TryRunCommand(string cmd, string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = cmd,
                    Arguments = args,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                Process p = Process.Start(psi);
                p.WaitForExit();
                return p.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }
    }
}
