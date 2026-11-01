using System;
using System.IO;
using System.Diagnostics;
using System.Threading;

namespace PokeroledexLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "PokéroleDex 3.0 - Server Launcher";
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("========================================================");
            Console.WriteLine("             POKEROLEDEX 3.0 TTRPG COMPANION           ");
            Console.WriteLine("========================================================");
            Console.ResetColor();
            Console.WriteLine();

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            Directory.SetCurrentDirectory(appDir);

            string pythonExe = FindPython();

            if (string.IsNullOrEmpty(pythonExe))
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[!] Python non e stato trovato sul tuo computer.");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Molti utenti non hanno Python installato.");
                Console.WriteLine("Vuoi provare ad installarlo automaticamente con Windows Package Manager (winget)?");
                Console.Write("Installa Python adesso? [S/N]: ");

                string answer = Console.ReadLine();
                if (!string.IsNullOrEmpty(answer) && answer.Trim().ToLower().StartsWith("s"))
                {
                    Console.WriteLine("\nAvvio installazione di Python 3.12 via winget... Attendi...");
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
                    Console.WriteLine("\n[ATTENZIONE] Per eseguire PokéroleDex e necessario avere Python.");
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
                Console.WriteLine("[*] Controllo ed installazione automatica dipendenze (Flask)...");
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
                Console.WriteLine("Errore: Impossibile trovare " + scriptPath);
                Console.ResetColor();
                Console.ReadKey();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("[*] Avvio dell'applicazione PokéroleDex...");
            Console.WriteLine("[*] La web-app si aprira automaticamente su: http://127.0.0.1:5000/");
            Console.WriteLine("[*] Per chiudere l'applicazione chiudi questa finestra o premi CTRL+C.");
            Console.ResetColor();
            Console.WriteLine();

            ProcessStartInfo appPsi = new ProcessStartInfo
            {
                FileName = pythonExe,
                Arguments = "\"" + scriptPath + "\"",
                UseShellExecute = false,
                WorkingDirectory = appDir
            };

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

        static string FindPython()
        {
            // 1. Test 'python' command
            if (TryRunCommand("python", "--version")) return "python";

            // 2. Test 'py' launcher
            if (TryRunCommand("py", "--version")) return "py";

            // 3. Search LocalAppData Python
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

            // 4. Search C:\Python*
            string[] rootDirs = Directory.GetDirectories(@"C:\", "Python*");
            foreach (string d in rootDirs)
            {
                string candidate = Path.Combine(d, "python.exe");
                if (File.Exists(candidate)) return candidate;
            }

            // 5. Search Program Files
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pfPy = Path.Combine(pf, "Python*");
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
