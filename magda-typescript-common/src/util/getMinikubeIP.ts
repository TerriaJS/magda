import childProcess from "child_process";

export default function getMinikubeIP() {
    const minikubeProcess = childProcess.spawnSync("minikube", ["ip"]);
    const ip = minikubeProcess.stdout.toString().trim();

    return ip;
}
