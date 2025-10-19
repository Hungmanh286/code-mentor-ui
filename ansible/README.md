# topi-chatbot UI deploy

Deployment for topi-chatbot-ui project  

---

## Requirement  

* ansible >= 2.9  

* passwordless access to each server  

    ```bash
    ssh-copy-id vega@node-ip
    ```  

* ansible collection  

    ```bash
    ansible-galaxy install geerlingguy.docker
    ```

---

## Deploy topi-bot server

1. Config remote host in [inventory](./inventory)  

2. Edit your configuration in [secrets.yml](./ansible/vault/secrets.yml) and [template](./ansible/template/) if need  

3. Setup chatbot

* Make `~/.vault_pass` file to store ansible vault pass  
  
    ```bash
    ansible-playbook task/main.yml
    ```
