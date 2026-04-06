import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Choix5Component } from './choix5.component';

describe('Choix5Component', () => {
  let component: Choix5Component;
  let fixture: ComponentFixture<Choix5Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Choix5Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Choix5Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
