#!/usr/bin/python3
# Réceptionnaire de la clé GitHub restreinte : seulement deux sites statiques.
import ctypes
import fcntl
import grp
import os
from pathlib import Path, PurePosixPath
import pwd
import shutil
import sys
import tarfile
import tempfile
import time

root = Path('/var/www').resolve()
uid, gid = pwd.getpwnam('ubuntu').pw_uid, grp.getgrnam('www-data').gr_gid
libc = ctypes.CDLL(None, use_errno=True)

def exchange(left, right):
    if libc.renameat2(-100, os.fsencode(left), -100, os.fsencode(right), 2):
        raise OSError(ctypes.get_errno(), 'Échange atomique impossible')

def main():
    # Serialise aussi les déploiements manuels qui emploient ce script.
    with open('/run/lock/meriz-deploy.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stage = Path(tempfile.mkdtemp(prefix='meriz-incoming-', dir=root))
        total = 0

        def safe(member, destination):
            nonlocal total
            path = PurePosixPath(member.name)
            if not path.parts or path.parts[0] not in ('app', 'site') or '..' in path.parts:
                raise ValueError('Chemin de publication refusé')
            if not (member.isdir() or member.isfile()) or any(part in ('.git', '.env') for part in path.parts):
                raise ValueError('Seuls les fichiers statiques sont acceptés')
            total += member.size
            if total > 300 * 1024 * 1024:
                raise ValueError('Archive de publication trop grande')
            return tarfile.data_filter(member, destination)

        with tarfile.open(fileobj=sys.stdin.buffer, mode='r|gz') as archive:
            archive.extractall(stage, filter=safe)
        targets = [('app', root/'meriz-app'), ('site', root/'meriz-site')]
        for name, live in targets:
            if live.resolve() != live or not live.is_dir() or not (stage/name/'index.html').is_file():
                raise ValueError('Dossier ou index de publication invalide')
        # Préserver les imports différés des fenêtres ouvertes sur l'ancien build.
        old_assets, new_assets = root/'meriz-app/assets', stage/'app/assets'
        new_assets.mkdir(exist_ok=True)
        for entry in old_assets.iterdir():
            if entry.is_file() and not (new_assets/entry.name).exists():
                shutil.copy2(entry, new_assets/entry.name)
        for directory, _, files in os.walk(stage):
            os.chown(directory, uid, gid)
            os.chmod(directory, 0o2755)
            for name in files:
                file = Path(directory)/name
                os.chown(file, uid, gid)
                os.chmod(file, 0o644)
        swapped = []
        try:
            for name, live in targets:
                exchange(live, stage/name)
                swapped.append((live, stage/name))
        except Exception:
            for live, previous in reversed(swapped):
                exchange(live, previous)
            raise
        suffix = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())+'-'+stage.name.rsplit('-', 1)[-1]
        for name, live in targets:
            backup = root/(live.name+'-backup-'+suffix)
            (stage/name).rename(backup)
            print('Publié :', live, '; sauvegarde :', backup, flush=True)
        stage.rmdir()

if __name__ == '__main__':
    main()
